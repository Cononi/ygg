import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react'
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
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import AppsRoundedIcon from '@mui/icons-material/AppsRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'

import { api } from '../api/client'
import Changes from './Changes'
import type { ProjectContentType, ProjectDetail as ProjectDetailType } from '../types'
import {
  buildProjectFlowElements,
  filterTargetFileItems,
  flattenTargetFileItems,
  formatDescriptionSourceLabel,
  formatProjectStageLabel,
  getProjectStageTone,
  hasMultipleTargets,
  summarizeAppliedInits,
} from '../utils/projectDashboard'
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
  const [activeTarget, setActiveTarget] = useState<'all' | string>('all')

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

  const allTargetFiles = useMemo(() => {
    if (!detail || tab === 'changes') return []
    return flattenTargetFileItems(detail.targets, tab)
  }, [detail, tab])

  const activeFiles = useMemo(
    () => filterTargetFileItems(allTargetFiles, activeTarget),
    [activeTarget, allTargetFiles],
  )

  const appliedInitSummary = useMemo(
    () => summarizeAppliedInits(detail?.info.appliedInits ?? []),
    [detail],
  )

  const flowElements = useMemo(
    () => detail ? buildProjectFlowElements(detail.flowSnapshot) : { nodes: [], edges: [] },
    [detail],
  )

  const showTargetFilter = Boolean(detail && tab !== 'changes' && hasMultipleTargets(detail.targets))
  const availableTargets = detail?.info.summary.activeTargets ?? []

  const descriptionChanged = (detail?.info.description ?? '') !== descriptionDraft.trim()

  useEffect(() => {
    if (!showTargetFilter) {
      setActiveTarget('all')
      return
    }

    if (activeTarget !== 'all' && !availableTargets.some(target => target.id === activeTarget)) {
      setActiveTarget('all')
    }
  }, [activeTarget, availableTargets, showTargetFilter])

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
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 2,
          background: 'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.92))',
          color: '#f8fafc',
        }}
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between">
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="overline" sx={{ color: 'rgba(248,250,252,0.72)' }}>
                Project detail
              </Typography>
              <Typography variant="h4" sx={{ mt: 0.5, color: '#f8fafc' }}>{detail.info.name}</Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'rgba(248,250,252,0.72)' }}>
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
                  color: '#f8fafc',
                  borderColor: 'rgba(248,250,252,0.18)',
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
            <Chip label={`category ${detail.info.category}`} variant="outlined" sx={{ color: '#f8fafc', borderColor: 'rgba(248,250,252,0.2)' }} />
            <Chip label={`stage ${formatProjectStageLabel(detail.info.summary.currentStage)}`} color={getProjectStageTone(detail.info.summary.currentStage)} />
            <Chip label={`next ${detail.info.summary.nextAction}`} variant="outlined" sx={{ color: '#f8fafc', borderColor: 'rgba(248,250,252,0.2)' }} />
            <Chip label={formatDescriptionSourceLabel(detail.info.summary.descriptionSource)} variant="outlined" sx={{ color: '#f8fafc', borderColor: 'rgba(248,250,252,0.2)' }} />
            {detail.info.latestReleaseVersion && (
              <Chip label={`latest ${detail.info.latestReleaseVersion}`} variant="outlined" sx={{ color: '#f8fafc', borderColor: 'rgba(248,250,252,0.2)' }} />
            )}
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {detail.info.summary.tags.map(tag => (
              <Chip key={tag} size="small" label={tag} sx={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#f8fafc' }} />
            ))}
          </Stack>

          <Typography variant="body1" sx={{ color: 'rgba(248,250,252,0.86)', maxWidth: 920 }}>
            {detail.info.summary.description}
          </Typography>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: { xl: '0 0 360px' } }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="text.secondary">State guide</Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>Why this stage is active</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                프로젝트 상세의 stage와 next action은 live `ygg/change/INDEX.md` 기준으로 계산합니다.
              </Typography>
            </Box>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Current stage</Typography>
              <Chip
                label={formatProjectStageLabel(detail.info.summary.currentStage)}
                color={getProjectStageTone(detail.info.summary.currentStage)}
                sx={{ alignSelf: 'flex-start' }}
              />
              <Typography variant="body2" color="text.secondary">
                다음 액션: {detail.info.summary.nextAction}
              </Typography>
              <Stack spacing={0.75}>
                {detail.info.summary.stageReason.map((reason, index) => (
                  <Typography key={`summary-stage-reason-${index}`} variant="body2" color="text.secondary">
                    {reason}
                  </Typography>
                ))}
              </Stack>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Next action reasoning</Typography>
              {detail.info.summary.nextActionReason.map((reason, index) => (
                <Typography key={`summary-next-reason-${index}`} variant="body2" color="text.secondary">
                  {reason}
                </Typography>
              ))}
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Applied init</Typography>
              {detail.info.appliedInits.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  현재 확인된 적용 init이 없습니다.
                </Typography>
              ) : (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {appliedInitSummary.visible.map(init => (
                    <Chip key={init.id} size="small" label={init.label} variant="outlined" />
                  ))}
                  {appliedInitSummary.overflow > 0 && (
                    <Chip size="small" label={`+${appliedInitSummary.overflow}`} />
                  )}
                </Stack>
              )}
              <Typography variant="body2" color="text.secondary">
                여러 target이 활성화된 프로젝트에서는 아래 Project content에서 target별로 파일 목록을 분리해 볼 수 있습니다.
              </Typography>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Description editor</Typography>
              <TextField
                multiline
                minRows={4}
                value={descriptionDraft}
                onChange={event => setDescriptionDraft(event.target.value)}
                placeholder="이 프로젝트가 무엇을 위한 프로젝트인지 설명을 적어주세요."
                fullWidth
              />
              <Typography variant="body2" color="text.secondary">
                카드와 상세 상단 설명은 저장된 설명이 있으면 그 값을, 없으면 generated 설명을 사용합니다.
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
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

            {detail.info.summary.activeTopic && (
              <Button
                variant="outlined"
                endIcon={<ArrowOutwardRoundedIcon />}
                onClick={() => navigate(`/projects/${id}/changes/${encodeURIComponent(detail.info.summary.activeTopic ?? '')}`)}
              >
                Active topic 열기
              </Button>
            )}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1, minWidth: 0 }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="overline" color="text.secondary">Flow canvas</Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>Project internal flow</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                live change index를 기준으로 현재 stage, 근거 문장, 문서 존재 여부, 다음 액션 연결을 시각화합니다.
              </Typography>
            </Box>

            <Box
              sx={{
                height: 440,
                borderRadius: 2,
                overflow: 'hidden',
                border: theme => `1px solid ${theme.palette.divider}`,
                background: 'linear-gradient(180deg, rgba(248,250,252,0.92), rgba(226,232,240,0.92))',
              }}
            >
              <ReactFlow
                nodes={flowElements.nodes}
                edges={flowElements.edges}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag
                proOptions={{ hideAttribution: true }}
              >
                <MiniMap pannable zoomable />
                <Controls showInteractive={false} />
                <Background gap={18} color="#cbd5e1" />
              </ReactFlow>
            </Box>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip size="small" label={`current ${detail.flowSnapshot.legend.currentStage}`} variant="outlined" />
              <Chip size="small" label={`next ${detail.flowSnapshot.legend.nextAction}`} variant="outlined" />
              <Chip size="small" label="source live index" variant="outlined" />
              <Chip
                size="small"
                label={detail.flowSnapshot.legend.hasGeneratedDescription ? 'generated description' : 'manual description'}
                variant="outlined"
              />
            </Stack>

            <Stack spacing={0.75}>
              {detail.flowSnapshot.legend.stageReason.map((reason, index) => (
                <Typography key={`flow-stage-reason-${index}`} variant="body2" color="text.secondary">
                  {reason}
                </Typography>
              ))}
              {detail.flowSnapshot.legend.nextActionReason.map((reason, index) => (
                <Typography key={`flow-next-reason-${index}`} variant="body2" color="text.secondary">
                  {reason}
                </Typography>
              ))}
            </Stack>
          </Stack>
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: 2, pt: 2 }}>
          <Typography variant="h6">Project content</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {tab === 'changes'
              ? 'changes는 최신 흐름을 빠르게 읽을 수 있도록 타임라인형 이력 뷰로 표시합니다.'
              : '실제 프로젝트 파일과 ygg changes 인덱스를 기준으로 내용을 읽습니다. target이 여러 개면 목록을 분리해서 볼 수 있습니다.'}
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
          {showTargetFilter && (
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Target filter</Typography>
              <ToggleButtonGroup
                value={activeTarget}
                exclusive
                size="small"
                onChange={(_, value: 'all' | string | null) => {
                  if (value) setActiveTarget(value)
                }}
              >
                <ToggleButton value="all">All</ToggleButton>
                {availableTargets.map(target => (
                  <ToggleButton key={target.id} value={target.id}>
                    {target.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
          )}

          {tab === 'changes' ? (
            <Changes projectId={id ?? ''} onChangeMutated={() => void loadDetail()} />
          ) : activeFiles.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="subtitle1">아직 {tab} 파일이 없습니다.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {activeTarget === 'all'
                  ? `현재 프로젝트 타깃에서 읽을 수 있는 ${tab} 파일이 없었습니다.`
                  : `${availableTargets.find(target => target.id === activeTarget)?.label ?? activeTarget} target에서 읽을 수 있는 ${tab} 파일이 없었습니다.`}
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              {activeFiles.map(file => (
                <Paper key={file.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
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
