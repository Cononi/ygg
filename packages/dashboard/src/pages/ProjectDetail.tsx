import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
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
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { api } from '../api/client'
import type { ChangeStatus, ProjectDetail as ProjectDetailType, ProjectInfo } from '../types'
import {
  buildChangeSummary,
  createLatestRequestGuard,
  createProjectDetailResetState,
  resolveProjectDetailChangeStatus,
} from '../utils/projectViewState'
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
  const navigate = useNavigate()
  const location = useLocation()
  const [detail, setDetail] = useState<ProjectDetailType | null>(null)

  const [target, setTarget] = useState('')
  const [tab, setTab] = useState<Tab>('skills')
  const [changeStatus, setChangeStatus] = useState<ChangeStatus>(createProjectDetailResetState().changeStatus)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const loadGuardRef = useRef(createLatestRequestGuard())
  const navigationProjectInfo = (
    typeof location.state === 'object' &&
    location.state !== null &&
    'projectInfo' in location.state
  )
    ? (location.state as { projectInfo?: ProjectInfo }).projectInfo
    : undefined
  const selectedProjectInfo = navigationProjectInfo?.id === id ? navigationProjectInfo : undefined

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
    const requestId = loadGuardRef.current.begin()

    try {
      setLoading(true)
      setError(null)
      const [data, changes] = await Promise.all([
        api.projects.get(id),
        api.changes.list(id).catch(() => null),
      ])
      if (!loadGuardRef.current.isCurrent(requestId)) return

      setDetail(data)
      const fallbackChangeStatus = data.info.changeStatus.total > 0
        ? data.info.changeStatus
        : (selectedProjectInfo?.changeStatus ?? data.info.changeStatus)
      setChangeStatus(resolveProjectDetailChangeStatus(
        changes ? buildChangeSummary(changes) : null,
        fallbackChangeStatus,
      ))
    } catch (e) {
      if (!loadGuardRef.current.isCurrent(requestId)) return
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      if (!loadGuardRef.current.isCurrent(requestId)) return
      setLoading(false)
    }
  }, [id, selectedProjectInfo])

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
    const reset = createProjectDetailResetState()
    setDetail(null)
    setLoading(true)
    setError(null)
    setTab(reset.tab)
    setTarget(reset.target)
    setChangeStatus(selectedProjectInfo?.changeStatus ?? reset.changeStatus)
  }, [id, selectedProjectInfo])

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

  const handleDeleteProject = useCallback(async () => {
    if (!id) return
    setDeleting(true)
    try {
      await api.projects.remove(id)
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }, [id, navigate])

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
  const totalChangeCount = changeStatus.total
  const versionColor = VERSION_COLOR[info.versionStatus] ?? 'default'
  const projectVersionLabel = `v${info.projectVersion ?? '0.0.0'}`
  const isLatestProjectVersion = info.latestReleaseVersion === projectVersionLabel
  const currentTarget = targets.find(source => source.target === target) ?? targets[0]
  const currentFiles = currentTarget?.files ?? { skills: [], agents: [], commands: [] }
  const workspaceLabels = targets.map(source => source.label)

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
            <IconButton
              aria-label="project actions"
              onClick={event => setMenuAnchorEl(event.currentTarget)}
            >
              <MoreVertIcon />
            </IconButton>
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 1, height: '100%' }}>
              <Typography variant="caption" color="text.secondary">Change summary</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                현재 진행 중인 작업과 완료 후 보관된 change 이력을 나눠서 보여줍니다.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                <Chip label={`진행 중 ${changeStatus.inProgress}`} color="primary" size="small" />
                <Chip label={`보관됨 ${changeStatus.done}`} variant="outlined" size="small" />
                <Chip label={`전체 ${changeStatus.total}`} variant="outlined" size="small" />
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 1, height: '100%' }}>
              <Typography variant="caption" color="text.secondary">Workspaces</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                Claude Code, Codex 같은 환경별 문서 묶음입니다.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                <Chip label={`${targets.length}개 연결`} color="default" size="small" />
                {workspaceLabels.map(label => (
                  <Chip key={label} label={label} variant="outlined" size="small" />
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Paper variant="outlined" sx={{ borderRadius: 1, p: 1.5 }}>
          <Box sx={{ px: 1, pt: 0.5, pb: 1 }}>
            <Typography variant="subtitle1">
              Workspace files and change operations
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              작업 환경별로 생성된 skills, agents, commands 파일과 change 작업을 확인합니다.
            </Typography>
          </Box>

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
            <Tab label={`Changes (${totalChangeCount})`} value="changes" />
          </Tabs>

          {tab === 'changes' ? (
            <Changes
              projectId={id!}
              initialSubTab="active"
              onSummaryChange={setChangeStatus}
            />
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

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null)
            setDeleteDialogOpen(true)
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          프로젝트 삭제
        </MenuItem>
      </Menu>

      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>프로젝트 삭제</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            이 작업은 dashboard registry에서만 프로젝트를 제거합니다. 실제 프로젝트 폴더와 파일은 삭제하지 않습니다.
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            {info.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {info.path}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>취소</Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteProject()} disabled={deleting}>
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
