import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import AddIcon from '@mui/icons-material/Add'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import { api } from '../api/client'
import type { ProjectInfo } from '../types'

export default function ProjectSidebar() {
  const navigate = useNavigate()
  const { id: currentId } = useParams<{ id: string }>()
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addPath, setAddPath] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { projects: list } = await api.projects.list()
      setProjects(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  const completedProjects = projects.filter(project => project.changeStatus.done > 0).length

  const handleAdd = async () => {
    if (!addPath.trim()) return
    try {
      setAdding(true)
      setAddError(null)
      const { project } = await api.projects.add(addPath.trim())
      setAddPath('')
      setShowAdd(false)
      await load()
      navigate(`/projects/${project.id}`)
    } catch (e) {
      setAddError(e instanceof Error ? e.message : '추가 실패')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Workspace
            </Typography>
            <Typography variant="h6">Projects</Typography>
            <Typography variant="body2" color="text.secondary">
              운영 중인 ygg 프로젝트와 버전 상태를 한곳에서 관리합니다.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Paper variant="outlined" sx={{ flex: 1, p: 1.25, borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">등록 프로젝트</Typography>
              <Typography variant="h6">{projects.length}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ flex: 1, p: 1.25, borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">완료 이력</Typography>
              <Typography variant="h6">{completedProjects}</Typography>
            </Paper>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="contained"
          size="medium"
          startIcon={<AddIcon />}
          onClick={() => setShowAdd(true)}
          sx={{ borderRadius: 1 }}
        >
          프로젝트 추가
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : projects.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
          등록된 프로젝트가 없습니다
        </Typography>
      ) : (
        <Stack spacing={1.25} sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
          {projects.map(p => {
            const isSelected = p.id === currentId
            return (
              <Paper
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  cursor: 'pointer',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: isSelected ? 'action.selected' : 'background.paper',
                  transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: 2,
                  },
                }}
              >
                <Stack spacing={1.25}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>{p.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                        {p.path}
                      </Typography>
                    </Box>
                    <Chip
                      label={`v${p.projectVersion ?? '0.0.0'}`}
                      color={isSelected ? 'primary' : 'default'}
                      size="small"
                      sx={{ flexShrink: 0, fontSize: '0.65rem' }}
                      title={`ygg v${p.yggVersion ?? '?'} | 프로젝트 v${p.projectVersion ?? '0.0.0'}`}
                    />
                  </Box>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip icon={<FolderOpenOutlinedIcon />} label={`${p.changeStatus.inProgress} active`} size="small" variant="outlined" />
                    <Chip icon={<TaskAltOutlinedIcon />} label={`${p.changeStatus.done} done`} size="small" variant="outlined" />
                  </Stack>
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      )}

      <Dialog open={showAdd} onClose={() => setShowAdd(false)} fullWidth maxWidth="sm">
        <DialogTitle>프로젝트 추가</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            placeholder="/Users/you/work/my-project"
            value={addPath}
            onChange={e => setAddPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void handleAdd()}
            error={!!addError}
            helperText={addError ?? undefined}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowAdd(false); setAddError(null) }}>취소</Button>
          <Button variant="contained" onClick={() => void handleAdd()} disabled={adding}>
            {adding ? '추가 중...' : '추가'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
