import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'

import { api } from '../api/client'
import type { ProjectInfo, ProjectListResponse } from '../types'

const EMPTY_LIST: ProjectListResponse = {
  categories: [],
  projects: [],
  groupedProjects: [],
}

export default function ProjectHome() {
  const navigate = useNavigate()
  const [data, setData] = useState<ProjectListResponse>(EMPTY_LIST)
  const [loading, setLoading] = useState(true)
  const [showAddProject, setShowAddProject] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [projectPath, setProjectPath] = useState('')
  const [projectCategory, setProjectCategory] = useState('home')
  const [moveCategory, setMoveCategory] = useState('home')
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.projects.list())
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const totalContent = useMemo(
    () => data.projects.reduce((sum, project) =>
      sum
      + project.contentSummary.skills
      + project.contentSummary.agents
      + project.contentSummary.commands
      + project.contentSummary.changes, 0),
    [data.projects],
  )

  const handleAddProject = async () => {
    if (!projectPath.trim()) return
    setSubmitting(true)
    try {
      const result = await api.projects.add(projectPath.trim(), projectCategory)
      setProjectPath('')
      setProjectCategory(data.categories[0] ?? 'home')
      setShowAddProject(false)
      await load()
      navigate(`/projects/${result.project.id}`)
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '프로젝트 추가 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteProject = async (project: ProjectInfo) => {
    if (!confirm(`"${project.name}" 프로젝트를 registry에서 제거할까요? 실제 폴더는 삭제되지 않습니다.`)) return
    try {
      await api.projects.remove(project.id)
      await load()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '프로젝트 삭제 실패')
    }
  }

  const openMoveDialog = (project: ProjectInfo) => {
    setSelectedProject(project)
    setMoveCategory(project.category)
    setShowMoveDialog(true)
  }

  const handleMoveProject = async () => {
    if (!selectedProject) return
    setSubmitting(true)
    try {
      await api.projects.moveCategory(selectedProject.id, moveCategory)
      setShowMoveDialog(false)
      setSelectedProject(null)
      await load()
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : '카테고리 이동 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Workspace overview
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              Project workspace hub
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 880 }}>
              프로젝트 설명과 실제 skills, agents, commands, changes 현황을 카드에서 바로 확인하고,
              카드를 눌러 상세 화면으로 이동해 바로 관리할 수 있습니다.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary">등록 프로젝트</Typography>
              <Typography variant="h5">{data.projects.length}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary">카테고리</Typography>
              <Typography variant="h5">{data.categories.length}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary">표시 항목 합계</Typography>
              <Typography variant="h5">{totalContent}</Typography>
            </Paper>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button variant="contained" onClick={() => setShowAddProject(true)}>프로젝트 추가</Button>
            <Button variant="outlined" onClick={() => navigate('/manage/categories')}>Operations</Button>
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          {data.groupedProjects.map(group => (
            <Paper key={group.category} variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 1 }}>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap alignItems={{ xs: 'flex-start', md: 'center' }}>
                  <Typography variant="h6">{group.category}</Typography>
                  <Chip size="small" label={`${group.projects.length} projects`} variant="outlined" />
                </Stack>
                {group.projects.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    이 카테고리에는 아직 프로젝트가 없습니다.
                  </Typography>
                ) : (
                  <Grid container spacing={1.5}>
                    {group.projects.map(project => (
                      <Grid key={project.id} item xs={12} md={6} xl={4}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            borderRadius: 1,
                            height: '100%',
                            cursor: 'pointer',
                            transition: 'border-color 160ms ease, transform 160ms ease',
                            '&:hover': {
                              borderColor: 'primary.main',
                              transform: 'translateY(-2px)',
                            },
                          }}
                          onClick={() => navigate(`/projects/${project.id}`)}
                        >
                          <Stack spacing={1.5} sx={{ height: '100%' }}>
                            <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
                              <Stack direction="row" spacing={0.25} alignItems="center" sx={{ alignSelf: 'flex-start', ml: -0.5 }}>
                                <Tooltip title="디테일">
                                  <IconButton
                                    size="small"
                                    onClick={event => {
                                      event.stopPropagation()
                                      navigate(`/projects/${project.id}`)
                                    }}
                                  >
                                    <LaunchRoundedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="카테고리 이동">
                                  <IconButton
                                    size="small"
                                    onClick={event => {
                                      event.stopPropagation()
                                      openMoveDialog(project)
                                    }}
                                  >
                                    <DriveFileMoveOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="프로젝트 삭제">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={event => {
                                      event.stopPropagation()
                                      void handleDeleteProject(project)
                                    }}
                                  >
                                    <DeleteOutlineRoundedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                                  {project.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {project.path}
                                </Typography>
                              </Box>
                            </Stack>

                            <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44 }}>
                              {project.description?.trim() || '프로젝트 설명이 아직 없습니다. 상세 상단에서 설명을 추가할 수 있습니다.'}
                            </Typography>

                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                              <Chip size="small" label={`skills ${project.contentSummary.skills}`} />
                              <Chip size="small" label={`agents ${project.contentSummary.agents}`} />
                              <Chip size="small" label={`commands ${project.contentSummary.commands}`} />
                              <Chip size="small" label={`changes ${project.contentSummary.changes}`} />
                            </Stack>
                            <Divider sx={{ mt: 'auto' }} />
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={showAddProject} onClose={() => setShowAddProject(false)} fullWidth maxWidth="sm">
        <DialogTitle>프로젝트 추가</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              label="프로젝트 경로"
              value={projectPath}
              onChange={event => setProjectPath(event.target.value)}
              fullWidth
            />
            <TextField
              select
              label="기본 카테고리"
              value={projectCategory}
              onChange={event => setProjectCategory(event.target.value)}
            >
              {(data.categories.length > 0 ? data.categories : ['home']).map(category => (
                <MenuItem key={category} value={category}>{category}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddProject(false)}>취소</Button>
          <Button onClick={() => void handleAddProject()} variant="contained" disabled={submitting}>
            추가
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showMoveDialog} onClose={() => setShowMoveDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>카테고리 이동</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedProject?.name} 프로젝트를 이동할 카테고리를 선택하세요.
            </Typography>
            <TextField
              select
              label="카테고리"
              value={moveCategory}
              onChange={event => setMoveCategory(event.target.value)}
            >
              {data.categories.map(category => (
                <MenuItem key={category} value={category}>{category}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMoveDialog(false)}>취소</Button>
          <Button onClick={() => void handleMoveProject()} variant="contained" disabled={submitting}>
            이동
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
