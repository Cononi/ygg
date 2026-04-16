import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import ButtonGroup from '@mui/material/ButtonGroup'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import AppsRoundedIcon from '@mui/icons-material/AppsRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'

import { api } from '../api/client'
import Changes from './Changes'
import type { ProjectContentType, ProjectDetail as ProjectDetailType } from '../types'
import { flattenTargetFileItems } from '../utils/projectDashboard'
import { shouldUseHistoryBack } from '../utils/navigation'

const CONTENT_TABS: ProjectContentType[] = ['skills', 'agents', 'commands', 'changes']

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ProjectDetailType | null>(null)
  const [tab, setTab] = useState<ProjectContentType>('skills')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const nextDetail = await api.projects.get(id)
      setDetail(nextDetail)
      setDescriptionDraft(nextDetail.info.description ?? '')
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void loadDetail() }, [loadDetail])

  const activeFiles = useMemo(() => {
    if (!detail || tab === 'changes') return []
    return flattenTargetFileItems(detail.targets, tab)
  }, [detail, tab])

  const descriptionChanged = (detail?.info.description ?? '') !== descriptionDraft.trim()

  const handleSaveDescription = async () => {
    if (!id) return
    setSavingDescription(true)
    try {
      await api.projects.updateMeta(id, { description: descriptionDraft })
      await loadDetail()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '프로젝트 설명 저장 실패')
    } finally {
      setSavingDescription(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!id || !detail) return
    if (!confirm(`"${detail.info.name}" 프로젝트를 registry에서 제거할까요? 실제 폴더는 삭제되지 않습니다.`)) return
    setDeletingProject(true)
    try {
      await api.projects.remove(id)
      navigate('/')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '프로젝트 삭제 실패')
    } finally {
      setDeletingProject(false)
    }
  }

  const handleGoBack = () => {
    if (shouldUseHistoryBack(window.history.length, location.key)) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!detail) {
    return <Alert severity="error">프로젝트를 찾을 수 없습니다.</Alert>
  }

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between">
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Project detail
              </Typography>
              <Typography variant="h4" sx={{ mt: 0.5 }}>{detail.info.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {detail.info.path}
              </Typography>
            </Box>

            <ButtonGroup
              variant="outlined"
              size="medium"
              color="inherit"
              sx={{
                alignSelf: { xs: 'stretch', lg: 'flex-start' },
                '& .MuiButton-root': {
                  minHeight: 40,
                  px: 1.5,
                  justifyContent: 'flex-start',
                },
              }}
            >
              <Button onClick={handleGoBack} startIcon={<ArrowBackRoundedIcon />}>
                뒤로 가기
              </Button>
              <Button onClick={() => navigate('/')} startIcon={<AppsRoundedIcon />}>
                프로젝트 목록
              </Button>
              <Button color="error" onClick={() => void handleDeleteProject()} disabled={deletingProject} startIcon={<DeleteOutlineRoundedIcon />}>
                {deletingProject ? '삭제 중...' : '프로젝트 삭제'}
              </Button>
            </ButtonGroup>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`category ${detail.info.category}`} variant="outlined" />
            <Chip label={`project v${detail.info.projectVersion}`} />
            <Chip label={`ygg v${detail.info.yggVersion}`} variant="outlined" />
            {detail.info.latestReleaseVersion && (
              <Chip label={`latest ${detail.info.latestReleaseVersion}`} variant="outlined" />
            )}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">프로젝트 설명</Typography>
            <TextField
              multiline
              minRows={3}
              value={descriptionDraft}
              onChange={event => setDescriptionDraft(event.target.value)}
              placeholder="이 프로젝트가 무엇을 위한 프로젝트인지 설명을 적어주세요."
              fullWidth
            />
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                카드 설명은 이 값과 항상 동일하게 표시됩니다.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="text"
                  disabled={!descriptionChanged}
                  onClick={() => setDescriptionDraft(detail.info.description ?? '')}
                >
                  되돌리기
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!descriptionChanged || savingDescription}
                  onClick={() => void handleSaveDescription()}
                >
                  {savingDescription ? '저장 중...' : '설명 저장'}
                </Button>
              </Stack>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {CONTENT_TABS.map(type => (
              <Chip
                key={type}
                label={`${type} ${detail.info.contentSummary[type]}`}
                size="small"
                variant={tab === type ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ px: 2, pt: 2 }}>
          <Typography variant="h6">Project content</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            실제 프로젝트 파일과 ygg changes 인덱스를 기준으로 내용을 읽습니다.
          </Typography>
        </Box>

        <Tabs value={tab} onChange={(_, value: ProjectContentType) => setTab(value)} sx={{ px: 1.5, mt: 1 }}>
          {CONTENT_TABS.map(type => (
            <Tab
              key={type}
              value={type}
              label={`${type} (${detail.info.contentSummary[type]})`}
            />
          ))}
        </Tabs>

        <Divider />

        <Box sx={{ p: 2 }}>
          {tab === 'changes' ? (
            <Changes projectId={id ?? ''} />
          ) : activeFiles.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
              <Typography variant="subtitle1">아직 {tab} 파일이 없습니다.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                현재 프로젝트 타깃에서 읽을 수 있는 {tab} 파일이 없었습니다.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              {activeFiles.map(file => (
                <Paper key={file.id} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                    <Box>
                      <Typography variant="h6">{file.name}</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                        <Chip size="small" label={file.targetLabel} variant="outlined" />
                        <Chip size="small" label={file.type} variant="outlined" />
                      </Stack>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(
                        `/projects/${id}/files/${encodeURIComponent(file.target)}/${file.type}/${encodeURIComponent(file.name)}`,
                      )}
                    >
                      파일 열기
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Paper>
    </Stack>
  )
}
