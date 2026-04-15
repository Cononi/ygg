import { useState, useEffect, useCallback } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { api } from '../api/client'
import type { ProjectDetail as ProjectDetailType } from '../types'
import Changes from './Changes'

const VERSION_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  latest: 'success',
  'patch-behind': 'warning',
  'minor-behind': 'warning',
  'major-behind': 'error',
}

type Tab = 'skills' | 'agents' | 'commands' | 'changes'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ProjectDetailType | null>(null)

  const [target, setTarget] = useState('')
  const [tab, setTab] = useState<Tab>('skills')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

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

  const load = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const data = await api.projects.get(id)
      setDetail(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  const handleUpdate = useCallback(async () => {
    if (!id) return
    setUpdating(true)
    try {
      await api.projects.update(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setUpdating(false)
    }
  }, [id, load])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const state = location.state as { projectDetailTab?: Tab } | null
    if (state?.projectDetailTab === 'changes') {
      setTab('changes')
    }
  }, [location.state])

  const targets = detail?.targets ?? []
  useEffect(() => {
    if (!targets.length) {
      if (target !== '') setTarget('')
      return
    }
    if (!target || !targets.some(source => source.target === target)) {
      setTarget(targets[0].target)
    }
  }, [target, targets])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  if (!detail) return null

  const { info } = detail
  const activeChangeCount = info.changeStatus.inProgress
  const versionColor = VERSION_COLOR[info.versionStatus] ?? 'default'
  const projectVersionLabel = `v${info.projectVersion ?? '0.0.0'}`
  const isLatestProjectVersion = info.latestReleaseVersion === projectVersionLabel
  const currentTarget = targets.find(source => source.target === target) ?? targets[0]
  const currentFiles = currentTarget?.files ?? { skills: [], agents: [], commands: [] }

  const fileList = tab === 'skills' ? currentFiles.skills
    : tab === 'agents' ? currentFiles.agents
    : tab === 'commands' ? currentFiles.commands
    : []

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: '이름',
      flex: 1,
      renderCell: params => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 60,
      sortable: false,
      renderCell: params => (
        <IconButton
          size="small"
          onClick={() => {
            if (!currentTarget) return
            navigate(`/projects/${id}/files/${encodeURIComponent(currentTarget.target)}/${tab}/${encodeURIComponent(params.row.name as string)}`)
          }}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      ),
    },
  ]

  const rows = fileList.map(name => ({ id: name, name }))

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', md: 'flex-start' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="overline" color="text.secondary">
              Project detail
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              useFlexGap
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              sx={{ mt: 0.25 }}
            >
              <Typography variant="h4">{info.name}</Typography>
              <Chip
                label={`ygg cli v${info.yggVersion ?? '?'}`}
                color={versionColor}
                size="small"
                title="ygg CLI"
              />
              <Chip
                label={projectVersionLabel}
                color="default"
                size="small"
                title="프로젝트 버전"
              />
              {isLatestProjectVersion && (
                <Chip
                  label="latest"
                  color="success"
                  size="small"
                  title="최신 릴리즈"
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mt: 0.5 }}>
              {info.path}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            {info.versionStatus !== 'latest' && (
              <Typography variant="caption" color="text.secondary">→ v{info.currentVersion}</Typography>
            )}
            <Button
              variant={info.versionStatus !== 'latest' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => void handleUpdate()}
              disabled={updating}
              sx={{ borderRadius: 1 }}
            >
              {updating ? '업데이트 중...' : '업데이트'}
            </Button>
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Grid container spacing={2}>
          {[
            ['Change summary', `${info.changeStatus.inProgress} active / ${info.changeStatus.done} archived`],
            ['Targets', `${targets.length} source${targets.length === 1 ? '' : 's'}`],
          ].map(([label, value]) => (
            <Grid key={label} size={{ xs: 12, sm: 6 }}>
              <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 1, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper variant="outlined" sx={{ borderRadius: 1, p: 1.5 }}>
          <Typography variant="subtitle1" sx={{ px: 1, pt: 0.5, pb: 1 }}>
            File sources and change operations
          </Typography>

          {targets.length > 0 && (
            <Tabs
              value={currentTarget?.target ?? false}
              onChange={(_, v: string) => setTarget(v)}
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 1.5 }}
              variant="scrollable"
              scrollButtons="auto"
            >
              {targets.map(source => (
                <Tab
                  key={source.target}
                  label={`${source.label} (${source.files.skills.length + source.files.agents.length + source.files.commands.length})`}
                  value={source.target}
                />
              ))}
            </Tabs>
          )}

          <Tabs
            value={tab}
            onChange={(_, v: Tab) => setTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            <Tab label={`스킬 (${currentFiles.skills.length})`} value="skills" />
            <Tab label={`에이전트 (${currentFiles.agents.length})`} value="agents" />
            <Tab label={`커맨드 (${currentFiles.commands.length})`} value="commands" />
            <Tab label={`Changes (${activeChangeCount})`} value="changes" />
          </Tabs>

          {tab === 'changes' ? (
            <Changes projectId={id!} />
          ) : (
            <DataGrid
              rows={rows}
              columns={columns}
              autoHeight
              disableRowSelectionOnClick
              hideFooter={rows.length <= 100}
              sx={tableSx}
            />
          )}
        </Paper>
      </Stack>
    </Box>
  )
}
