import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'

import { api } from '../api/client'
import type { ProjectListResponse } from '../types'
import { buildCategoryProjectCounts } from '../utils/projectDashboard'

const EMPTY_LIST: ProjectListResponse = {
  categories: [],
  defaultCategory: 'home',
  categoryMeta: [],
  projects: [],
  groupedProjects: [],
}

export default function ProjectCategories() {
  const [data, setData] = useState<ProjectListResponse>(EMPTY_LIST)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.projects.list())
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '카테고리 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const projectCounts = useMemo(
    () => buildCategoryProjectCounts(data.groupedProjects),
    [data.groupedProjects],
  )

  const openRenameDialog = (category: string) => {
    setSelectedCategory(category)
    setDraftName(category)
    setRenameOpen(true)
  }

  const openDeleteDialog = (category: string) => {
    setSelectedCategory(category)
    setDeleteOpen(true)
  }

  const handleCreate = async () => {
    if (!draftName.trim()) return
    setSubmitting(true)
    try {
      await api.projects.createCategory(draftName.trim())
      setCreateOpen(false)
      setDraftName('')
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '카테고리 생성 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRename = async () => {
    if (!selectedCategory || !draftName.trim()) return
    setSubmitting(true)
    try {
      await api.projects.renameCategory(selectedCategory, draftName.trim())
      setRenameOpen(false)
      setSelectedCategory(null)
      setDraftName('')
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '카테고리 이름 변경 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedCategory) return
    setSubmitting(true)
    try {
      await api.projects.deleteCategory(selectedCategory)
      setDeleteOpen(false)
      setSelectedCategory(null)
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '카테고리 삭제 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetDefault = async (category: string) => {
    setSubmitting(true)
    try {
      await api.projects.updateDefaultCategory(category)
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '기본 카테고리 변경 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
          <Box>
            <Typography variant="overline" color="text.secondary">
              Category management
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              Project categories
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>
              현재 default 카테고리와 보드 정렬 상태를 확인합니다. 보드 순서는 홈에서 드래그로 바꾸고,
              여기서는 default 지정과 이름 변경, 삭제를 관리합니다.
            </Typography>
          </Box>
          <Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setDraftName('')
                setCreateOpen(true)
              }}
            >
              카테고리 추가
            </Button>
          </Box>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {data.categoryMeta.map(categoryMeta => {
            const category = categoryMeta.name
            const isDefault = categoryMeta.isDefault

            return (
              <Paper key={category} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Typography variant="h6">{category}</Typography>
                      <Chip size="small" label={`${projectCounts[category] ?? categoryMeta.projectCount ?? 0} projects`} variant="outlined" />
                      <Chip size="small" label={`order ${categoryMeta.order + 1}`} variant="outlined" />
                      {isDefault && <Chip size="small" label="default" color="primary" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {isDefault
                        ? '현재 기본 카테고리입니다. 새 프로젝트는 여기서 시작하고, 이름 변경과 삭제는 허용되지 않습니다.'
                        : `이 카테고리를 삭제하면 포함된 프로젝트가 기본 카테고리 ${data.defaultCategory}(으)로 이동합니다.`}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
                    <Button
                      size="small"
                      variant={isDefault ? 'contained' : 'outlined'}
                      disabled={isDefault || submitting}
                      onClick={() => void handleSetDefault(category)}
                    >
                      {isDefault ? '기본값' : '기본으로 지정'}
                    </Button>
                    <Tooltip title="이름 변경">
                      <span>
                        <IconButton
                          size="small"
                          disabled={isDefault}
                          onClick={() => openRenameDialog(category)}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="카테고리 삭제">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={isDefault}
                          onClick={() => openDeleteDialog(category)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>카테고리 추가</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="카테고리 이름"
            value={draftName}
            onChange={event => setDraftName(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>취소</Button>
          <Button onClick={() => void handleCreate()} variant="contained" disabled={submitting}>
            추가
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>카테고리 이름 변경</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="새 카테고리 이름"
            value={draftName}
            onChange={event => setDraftName(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>취소</Button>
          <Button onClick={() => void handleRename()} variant="contained" disabled={submitting}>
            저장
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>카테고리 삭제</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body1">
              {selectedCategory ? `"${selectedCategory}" 카테고리를 삭제하시겠습니까?` : '카테고리를 삭제하시겠습니까?'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              이 카테고리에 속한 프로젝트는 기본 카테고리 {data.defaultCategory}(으)로 이동합니다.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>취소</Button>
          <Button onClick={() => void handleDelete()} color="error" variant="contained" disabled={submitting}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
