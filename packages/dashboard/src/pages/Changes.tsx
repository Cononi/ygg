import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import CircularProgress from '@mui/material/CircularProgress'
import ArchiveIcon from '@mui/icons-material/Archive'
import DeleteIcon from '@mui/icons-material/Delete'
import UnarchiveIcon from '@mui/icons-material/Unarchive'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import { api } from '../api/client'
import { ARCHIVE_STATUS_LABEL, YGG_STAGES } from '../types'
import type { ChangeEntry } from '../types'
import {
  buildChangesSnapshotView,
  buildChangeSummary,
  createChangesResetState,
  createLatestRequestGuard,
} from '../utils/projectViewState'

interface ChangesProps {
  projectId: string
  initialSubTab?: SubTab
  onSummaryChange?: (summary: { inProgress: number; done: number; total: number }) => void
  onChangeMutated?: () => void
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

function TimelineItem({
  entry,
  isArchive,
  isEditingStage,
  onOpen,
  onStatusToggle,
  onStageEdit,
  onStageChange,
  onArchive,
  onRestore,
  onDelete,
}: {
  entry: ChangeEntry
  isArchive: boolean
  isEditingStage: boolean
  onOpen: () => void
  onStatusToggle: (entry: ChangeEntry) => void
  onStageEdit: (topic: string | null) => void
  onStageChange: (topic: string, stage: string) => void
  onArchive: (topic: string) => void
  onRestore: (topic: string) => void
  onDelete: (topic: string, isArchive: boolean) => void
}) {
  const status = entry.status || '🔄 진행중'
  const isDone = status.includes('완료')
  const timelineColor = isArchive ? 'success.light' : isDone ? 'success.main' : 'warning.main'

  return (
    <Box
      sx={{
        position: 'relative',
        pl: 4,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 12,
          top: 10,
          bottom: -20,
          width: 2,
          bgcolor: 'divider',
        },
        '&:last-of-type::before': {
          display: 'none',
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: 6,
          top: 8,
          width: 14,
          height: 14,
          borderRadius: '50%',
          bgcolor: timelineColor,
          border: theme => `2px solid ${theme.palette.background.paper}`,
          boxShadow: theme => `0 0 0 2px ${theme.palette.divider}`,
        }}
      />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 1.5 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-start' }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Button
                variant="text"
                color="inherit"
                endIcon={<ArrowOutwardRoundedIcon fontSize="small" />}
                onClick={onOpen}
                sx={{
                  px: 0,
                  minWidth: 0,
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
              >
                {entry.topic}
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {entry.description || (isArchive ? '완료된 change 설명이 없습니다.' : '진행 중인 change 설명이 없습니다.')}
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              {!isArchive && (
                <Chip
                  label={status}
                  color={isDone ? 'success' : 'warning'}
                  size="small"
                  onClick={() => onStatusToggle(entry)}
                  sx={{ cursor: 'pointer' }}
                />
              )}
              {isArchive && <Chip label={ARCHIVE_STATUS_LABEL} color="success" size="small" />}

              {isArchive ? (
                <Chip
                  label={(entry.type ?? 'fix')}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: 'monospace' }}
                />
              ) : isEditingStage ? (
                <Select
                  autoFocus
                  size="small"
                  value={entry.stage || '—'}
                  onChange={event => onStageChange(entry.topic, event.target.value)}
                  onBlur={() => onStageEdit(null)}
                  sx={{ minWidth: 108, fontSize: '0.8rem' }}
                >
                  {YGG_STAGES.map(stage => (
                    <MenuItem key={stage} value={stage}>{stage}</MenuItem>
                  ))}
                </Select>
              ) : (
                <Chip
                  label={entry.stage || '—'}
                  size="small"
                  variant="outlined"
                  onClick={() => onStageEdit(entry.topic)}
                  sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
                />
              )}

              {entry.yggPoint && entry.yggPoint !== '-' && (
                <Chip label={`YGG ${entry.yggPoint}`} size="small" variant="outlined" />
              )}
              {isArchive && (
                <Chip label={formatVersionLabel(entry.version)} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
              )}
              {isArchive && entry.latest === 'latest' && <Chip label="latest" size="small" color="primary" />}
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Chip label={isArchive ? 'Completed history' : 'Active topic'} size="small" variant="outlined" />
              <Chip label={formatDateLabel(entry.date)} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
              <Chip label={getDaysSince(entry.date)} size="small" />
            </Stack>

            <Stack direction="row" spacing={0.5}>
              {isArchive ? (
                <IconButton size="small" title="Active로 이동" onClick={() => onRestore(entry.topic)}>
                  <UnarchiveIcon fontSize="small" />
                </IconButton>
              ) : (
                <IconButton size="small" title="Archive로 이동" onClick={() => onArchive(entry.topic)}>
                  <ArchiveIcon fontSize="small" />
                </IconButton>
              )}
              <IconButton size="small" color="error" title="삭제" onClick={() => onDelete(entry.topic, isArchive)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  )
}

export default function Changes({ projectId, initialSubTab = 'active', onSummaryChange, onChangeMutated }: ChangesProps) {
  const [topics, setTopics] = useState<ChangeEntry[]>([])
  const [archiveTopics, setArchiveTopics] = useState<ChangeEntry[]>([])
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab)
  const [loading, setLoading] = useState(true)
  const [editingStage, setEditingStage] = useState<string | null>(null)
  const navigate = useNavigate()
  const loadGuardRef = useRef(createLatestRequestGuard())

  const buildTopicState = (entry: ChangeEntry, nextSubTab: SubTab) => ({
    changeEntry: entry,
    projectDetailTab: 'changes' as const,
    changesSubTab: nextSubTab,
  })

  const load = useCallback(async () => {
    const requestId = loadGuardRef.current.begin()

    try {
      setLoading(true)
      const data = await api.changes.list(projectId)
      if (!loadGuardRef.current.isCurrent(requestId)) return

      setTopics(data.topics)
      setArchiveTopics(data.archiveTopics)
      onSummaryChange?.(buildChangeSummary(data))
    } finally {
      if (!loadGuardRef.current.isCurrent(requestId)) return
      setLoading(false)
    }
  }, [onSummaryChange, projectId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const reset = createChangesResetState(initialSubTab)
    setLoading(true)
    setSubTab(reset.subTab)
    setEditingStage(reset.editingStage)
  }, [initialSubTab, projectId])

  const handleStatusToggle = async (topic: string, currentStatus: string) => {
    const newStatus = currentStatus.includes('완료') ? '🔄 진행중' : '✅ 완료'
    setTopics(prev => prev.map(t => t.topic === topic ? { ...t, status: newStatus } : t))
    try {
      await api.changes.patch(projectId, topic, 'status', newStatus)
      onChangeMutated?.()
    } catch {
      void load()
    }
  }

  const handleStageChange = async (topic: string, newStage: string) => {
    setEditingStage(null)
    setTopics(prev => prev.map(t => t.topic === topic ? { ...t, stage: newStage } : t))
    try {
      await api.changes.patch(projectId, topic, 'stage', newStage)
      onChangeMutated?.()
    } catch {
      void load()
    }
  }

  const handleArchive = async (topic: string) => {
    if (!confirm(`"${topic}"을 Archive로 이동할까요?`)) return
    try {
      await api.changes.archive(projectId, topic)
      await load()
      onChangeMutated?.()
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
      onChangeMutated?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  const handleRestore = async (topic: string) => {
    if (!confirm(`"${topic}"을 Active로 되돌릴까요?`)) return
    try {
      await api.changes.restore(projectId, topic)
      await load()
      onChangeMutated?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Active 이동 실패')
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  const snapshot = buildChangesSnapshotView({ topics, archiveTopics })

  if (snapshot.isCompletelyEmpty) {
    return (
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Typography color="text.secondary">Change 내역이 없습니다.</Typography>
      </Box>
    )
  }

  const latestArchiveVersion = snapshot.latestArchiveVersion ?? '-'

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        {[
          ['Active topics', String(snapshot.activeCount)],
          ['Completed history', String(snapshot.completedCount)],
          ['Latest release', latestArchiveVersion],
        ].map(([label, value]) => (
          <Grid key={label} xs={12} md={4}>
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
          <Tab label={`Active (${snapshot.activeCount})`} value="active" />
          <Tab label={`Completed (${snapshot.completedCount})`} value="archive" />
        </Tabs>

        {subTab === 'active' && (
          snapshot.activeEmpty
            ? <Typography color="text.secondary" sx={{ mt: 2 }}>진행 중인 change가 없습니다.</Typography>
            : (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  활성 change를 시간 흐름대로 읽고, 각 항목 안에서 상태와 단계를 바로 조정할 수 있습니다.
                </Typography>
                {snapshot.activeRows.map(entry => (
                  <TimelineItem
                    key={entry.id}
                    entry={entry}
                    isArchive={false}
                    isEditingStage={editingStage === entry.topic}
                    onOpen={() => navigate(`/projects/${projectId}/changes/${entry.topic}`, {
                      state: buildTopicState(entry, 'active'),
                    })}
                    onStatusToggle={nextEntry => void handleStatusToggle(nextEntry.topic, nextEntry.status || '🔄 진행중')}
                    onStageEdit={setEditingStage}
                    onStageChange={(topic, stage) => void handleStageChange(topic, stage)}
                    onArchive={topic => void handleArchive(topic)}
                    onRestore={() => undefined}
                    onDelete={(topic, activeArchive) => void handleDelete(topic, activeArchive)}
                  />
                ))}
              </Stack>
            )
        )}

        {subTab === 'archive' && (
          snapshot.archiveEmpty
            ? <Typography color="text.secondary" sx={{ mt: 2 }}>Archive가 없습니다.</Typography>
            : (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  공용 archive 경로를 통해 완료 처리된 항목입니다. 버전, latest, 날짜 메타데이터를 기준으로 릴리즈 흐름을 읽을 수 있습니다.
                </Typography>
                {snapshot.archiveRows.map(entry => (
                  <TimelineItem
                    key={entry.id}
                    entry={entry}
                    isArchive
                    isEditingStage={false}
                    onOpen={() => navigate(`/projects/${projectId}/changes/archive/${entry.topic}`, {
                      state: buildTopicState(entry, 'archive'),
                    })}
                    onStatusToggle={() => undefined}
                    onStageEdit={() => undefined}
                    onStageChange={() => undefined}
                    onArchive={() => undefined}
                    onRestore={topic => void handleRestore(topic)}
                    onDelete={(topic, activeArchive) => void handleDelete(topic, activeArchive)}
                  />
                ))}
              </Stack>
            )
        )}
      </Paper>
    </Stack>
  )
}
