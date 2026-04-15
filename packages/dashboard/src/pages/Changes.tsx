import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import CircularProgress from '@mui/material/CircularProgress'
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import ArchiveIcon from '@mui/icons-material/Archive'
import DeleteIcon from '@mui/icons-material/Delete'
import UnarchiveIcon from '@mui/icons-material/Unarchive'
import { api } from '../api/client'
import { ARCHIVE_STATUS_LABEL, YGG_STAGES } from '../types'
import type { ChangeEntry } from '../types'

interface ChangesProps {
  projectId: string
}

type SubTab = 'active' | 'archive'

function formatDateLabel(value?: string): string {
  return value && value !== '-' ? value : '-'
}

function getDaysSince(value?: string): string {
  if (!value || value === '-') return '-'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return '-'

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = startOfToday.getTime() - parsed.getTime()
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  return `${days}일 경과`
}

function formatVersionLabel(version?: string): string {
  const raw = version && version !== '-' ? version.trim() : ''
  if (!raw) return '-'
  return raw.startsWith('v') ? raw : `v${raw}`
}

export default function Changes({ projectId }: ChangesProps) {
  const [topics, setTopics] = useState<ChangeEntry[]>([])
  const [archiveTopics, setArchiveTopics] = useState<ChangeEntry[]>([])
  const [subTab, setSubTab] = useState<SubTab>('active')
  const [loading, setLoading] = useState(true)
  const [editingStage, setEditingStage] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  const tableSx = {
    border: 0,
    '& .MuiDataGrid-columnHeader': {
      alignItems: 'center',
    },
    '& .MuiDataGrid-cell': {
      display: 'flex',
      alignItems: 'center',
      py: 0.75,
    },
    '& .MuiDataGrid-cell .MuiTypography-root': {
      lineHeight: 1.4,
    },
  } as const

  const buildTopicState = (entry: ChangeEntry, nextSubTab: SubTab) => ({
    from: {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    },
    projectDetailTab: 'changes' as const,
    changesSubTab: nextSubTab,
    changeEntry: entry,
  })

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.changes.list(projectId)
      setTopics(data.topics)
      setArchiveTopics(data.archiveTopics)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const state = location.state as { changesSubTab?: SubTab } | null
    if (state?.changesSubTab) {
      setSubTab(state.changesSubTab)
    }
  }, [location.state])

  const handleStatusToggle = async (topic: string, currentStatus: string) => {
    const newStatus = currentStatus.includes('완료') ? '🔄 진행중' : '✅ 완료'
    setTopics(prev => prev.map(t => t.topic === topic ? { ...t, status: newStatus } : t))
    try {
      await api.changes.patch(projectId, topic, 'status', newStatus)
    } catch {
      void load()
    }
  }

  const handleStageChange = async (topic: string, newStage: string) => {
    setEditingStage(null)
    setTopics(prev => prev.map(t => t.topic === topic ? { ...t, stage: newStage } : t))
    try {
      await api.changes.patch(projectId, topic, 'stage', newStage)
    } catch {
      void load()
    }
  }

  const handleArchive = async (topic: string) => {
    if (!confirm(`"${topic}"을 Archive로 이동할까요?`)) return
    try {
      await api.changes.archive(projectId, topic)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Archive 이동 실패')
    }
  }

  const handleDelete = async (topic: string, isArchive = false) => {
    if (!confirm(`"${topic}"을 완전히 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return
    const topicKey = isArchive ? `archive/${topic}` : topic
    try {
      await api.changes.delete(projectId, topicKey)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  const handleRestore = async (topic: string) => {
    if (!confirm(`"${topic}"을 Active로 되돌릴까요?`)) return
    try {
      await api.changes.restore(projectId, topic)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Active 이동 실패')
    }
  }

  const activeColumns: GridColDef[] = [
    {
      field: 'topic',
      headerName: '토픽',
      flex: 1.5,
      renderCell: (params: GridRenderCellParams) => (
        <Typography
          variant="body2"
          sx={{ cursor: 'pointer', color: 'primary.main', fontFamily: 'monospace' }}
          onClick={() => navigate(`/projects/${projectId}/changes/${params.value as string}`, {
            state: buildTopicState(params.row as ChangeEntry, 'active'),
          })}
        >
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: '상태',
      width: 130,
      renderCell: (params: GridRenderCellParams) => {
        const status = (params.value as string) || '🔄 진행중'
        const isDone = status.includes('완료')
        return (
          <Chip
            label={status}
            color={isDone ? 'success' : 'warning'}
            size="small"
            onClick={() => void handleStatusToggle(params.row.topic as string, status)}
            sx={{ cursor: 'pointer' }}
          />
        )
      },
    },
    {
      field: 'stage',
      headerName: '단계',
      width: 140,
      renderCell: (params: GridRenderCellParams) => {
        const topic = params.row.topic as string
        if (editingStage === topic) {
          return (
            <Select
              autoFocus
              size="small"
              defaultValue={params.value as string || '—'}
              onChange={e => void handleStageChange(topic, e.target.value)}
              onBlur={() => setEditingStage(null)}
              sx={{ fontSize: '0.8rem' }}
            >
              {YGG_STAGES.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          )
        }
        return (
          <Chip
            label={params.value as string || '—'}
            size="small"
            variant="outlined"
            onClick={() => setEditingStage(topic)}
            sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
          />
        )
      },
    },
    {
      field: 'yggPoint',
      headerName: 'YGG Point',
      width: 110,
    },
    {
      field: 'description',
      headerName: '설명',
      flex: 2,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', minHeight: '100%' }}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'date',
      headerName: '마지막 날짜',
      width: 210,
      renderCell: (params: GridRenderCellParams) => (
        <Stack spacing={0.25} sx={{ py: 0.25, justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {formatDateLabel(params.value as string)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getDaysSince(params.value as string)}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'actions',
      headerName: '액션',
      width: 90,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            title="Archive로 이동"
            onClick={() => void handleArchive(params.row.topic as string)}
          >
            <ArchiveIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            title="삭제"
            onClick={() => void handleDelete(params.row.topic as string, false)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ]

  const archiveColumns: GridColDef[] = [
    {
      field: 'topic',
      headerName: '토픽',
      flex: 1,
      renderCell: (params: GridRenderCellParams) => (
        <Typography
          variant="body2"
          sx={{ cursor: 'pointer', color: 'primary.main', fontFamily: 'monospace' }}
          onClick={() => navigate(`/projects/${projectId}/changes/archive/${params.value as string}`, {
            state: buildTopicState(params.row as ChangeEntry, 'archive'),
          })}
        >
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'statusLabel',
      headerName: '상태',
      width: 150,
      sortable: false,
      renderCell: () => (
        <Chip label={ARCHIVE_STATUS_LABEL} color="success" size="small" />
      ),
    },
    {
      field: 'description',
      headerName: '설명',
      flex: 2,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', minHeight: '100%' }}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'version',
      headerName: '버전',
      width: 190,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={0.75} useFlexGap alignItems="center">
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {formatVersionLabel(params.value as string | undefined)}
          </Typography>
          {params.row.latest === 'latest' && <Chip label="latest" size="small" color="primary" />}
        </Stack>
      ),
    },
    {
      field: 'date',
      headerName: '완료 날짜',
      width: 210,
      renderCell: (params: GridRenderCellParams) => (
        <Stack spacing={0.25} sx={{ py: 0.25, justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {formatDateLabel(params.value as string)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getDaysSince(params.value as string)}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'actions',
      headerName: '액션',
      width: 110,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            title="Active로 이동"
            onClick={() => void handleRestore(params.row.topic as string)}
          >
            <UnarchiveIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            title="삭제"
            onClick={() => void handleDelete(params.row.topic as string, true)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ]

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (topics.length === 0 && archiveTopics.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Typography color="text.secondary">Change 내역이 없습니다.</Typography>
      </Box>
    )
  }

  const activeRows = topics.map(t => ({ id: t.topic, ...t }))
  const archiveRows = archiveTopics.map(t => ({ id: t.topic, ...t }))
  const latestArchive = archiveTopics.find(t => t.latest === 'latest')
  const latestArchiveVersion = formatVersionLabel(latestArchive?.version)

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        {[
          ['Active topics', String(topics.length)],
          ['Completed history', String(archiveTopics.length)],
          ['Latest release', latestArchiveVersion],
        ].map(([label, value]) => (
          <Grid key={label} size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
        <Tabs
          value={subTab}
          onChange={(_, v: SubTab) => setSubTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab label={`Active (${topics.length})`} value="active" />
          <Tab label={`Completed (${archiveTopics.length})`} value="archive" />
        </Tabs>

        {subTab === 'active' && (
          topics.length === 0
            ? <Typography color="text.secondary" sx={{ mt: 2 }}>진행 중인 change가 없습니다.</Typography>
            : (
              <DataGrid
                rows={activeRows}
                columns={activeColumns}
                autoHeight
                disableRowSelectionOnClick
                hideFooter={activeRows.length <= 100}
                sx={tableSx}
              />
            )
        )}

        {subTab === 'archive' && (
          archiveTopics.length === 0
            ? <Typography color="text.secondary" sx={{ mt: 2 }}>Archive가 없습니다.</Typography>
            : (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  공용 archive 경로를 통해 완료 처리된 항목입니다. 현재 archive 메타데이터의 버전, latest, 날짜 값을 기준으로 archived 이력을 표시합니다.
                </Typography>
                <DataGrid
                  rows={archiveRows}
                  columns={archiveColumns}
                  autoHeight
                  disableRowSelectionOnClick
                  hideFooter={archiveRows.length <= 100}
                  sx={tableSx}
                />
              </Stack>
            )
        )}
      </Paper>
    </Stack>
  )
}
