import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'

import { api } from '../api/client'
import type { ProjectCategoryMeta, ProjectInfo, ProjectListResponse } from '../types'
import {
  PROJECT_CARD_ACTION_ORDER,
  formatDescriptionSourceLabel,
  formatProjectStageLabel,
  getProjectStageTone,
} from '../utils/projectDashboard'

const EMPTY_LIST: ProjectListResponse = {
  categories: [],
  defaultCategory: 'home',
  categoryMeta: [],
  projects: [],
  groupedProjects: [],
}

type ActiveDrag =
  | { type: 'category'; category: string }
  | { type: 'project'; project: ProjectInfo }
  | null

function categoryDragId(category: string): string {
  return `category:${category}`
}

function laneDropId(category: string): string {
  return `lane:${category}`
}

function projectDragId(projectId: string): string {
  return `project:${projectId}`
}

function parseCategoryDragId(id: string | null | undefined): string | null {
  return id?.startsWith('category:') ? id.slice('category:'.length) : null
}

function parseLaneDropId(id: string | null | undefined): string | null {
  return id?.startsWith('lane:') ? id.slice('lane:'.length) : null
}

function parseProjectDragId(id: string | null | undefined): string | null {
  return id?.startsWith('project:') ? id.slice('project:'.length) : null
}

function sortProjects(projects: ProjectInfo[]): ProjectInfo[] {
  return [...projects].sort((left, right) => left.name.localeCompare(right.name))
}

function buildGroupedProjects(categories: string[], projects: ProjectInfo[]): ProjectListResponse['groupedProjects'] {
  return categories.map(category => ({
    category,
    projects: sortProjects(projects.filter(project => project.category === category)),
  }))
}

function buildCategoryMeta(
  categories: string[],
  defaultCategory: string,
  projects: ProjectInfo[],
): ProjectCategoryMeta[] {
  return categories.map((name, order) => ({
    name,
    order,
    isDefault: name === defaultCategory,
    projectCount: projects.filter(project => project.category === name).length,
  }))
}

function reorderDataCategories(data: ProjectListResponse, categories: string[]): ProjectListResponse {
  return {
    ...data,
    categories,
    categoryMeta: buildCategoryMeta(categories, data.defaultCategory, data.projects),
    groupedProjects: buildGroupedProjects(categories, data.projects),
  }
}

function moveProjectCategoryInData(
  data: ProjectListResponse,
  projectId: string,
  category: string,
): ProjectListResponse {
  const projects = data.projects.map(project =>
    project.id === projectId
      ? { ...project, category }
      : project,
  )

  return {
    ...data,
    projects,
    categoryMeta: buildCategoryMeta(data.categories, data.defaultCategory, projects),
    groupedProjects: buildGroupedProjects(data.categories, projects),
  }
}

function resolveDropCategory(
  overId: string | null | undefined,
  projects: ProjectInfo[],
): string | null {
  return parseLaneDropId(overId)
    ?? parseCategoryDragId(overId)
    ?? (() => {
      const projectId = parseProjectDragId(overId)
      return projectId ? projects.find(project => project.id === projectId)?.category ?? null : null
    })()
}

function ProjectDragPreview({
  title,
  subtitle,
  chips,
}: {
  title: string
  subtitle: string
  chips: string[]
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        width: 280,
        p: 1.5,
        borderRadius: 2,
        boxShadow: '0 24px 50px rgba(15, 23, 42, 0.18)',
      }}
    >
      <Stack spacing={1}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {chips.map(chip => <Chip key={chip} size="small" label={chip} variant="outlined" />)}
        </Stack>
      </Stack>
    </Paper>
  )
}

function ProjectCard({
  project,
  onDelete,
  onMove,
  onOpen,
}: {
  project: ProjectInfo
  onDelete: (project: ProjectInfo) => void
  onMove: (project: ProjectInfo) => void
  onOpen: (project: ProjectInfo) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: projectDragId(project.id),
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  const cardActions = PROJECT_CARD_ACTION_ORDER.map(action =>
    action === 'move'
      ? {
          key: action,
          title: '카테고리 이동',
          color: undefined as 'error' | undefined,
          icon: <DriveFileMoveOutlinedIcon fontSize="small" />,
          onClick: (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            onMove(project)
          },
        }
      : {
          key: action,
          title: '프로젝트 삭제',
          color: 'error' as const,
          icon: <DeleteOutlineRoundedIcon fontSize="small" />,
          onClick: (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            onDelete(project)
          },
        },
  )

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        ...style,
        p: 1.5,
        borderRadius: 2,
        cursor: 'pointer',
        opacity: isDragging ? 0.45 : 1,
        transition: 'border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
          boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)',
        },
      }}
      onClick={() => onOpen(project)}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
              {project.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
              {project.path}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.25} alignItems="center" sx={{ mr: -0.5, flexShrink: 0 }}>
            <Tooltip title="드래그 핸들">
              <IconButton
                size="small"
                onClick={event => event.stopPropagation()}
                {...attributes}
                {...listeners}
              >
                <DragIndicatorRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {cardActions.map(action => (
              <Tooltip key={action.key} title={action.title}>
                <IconButton size="small" color={action.color} onClick={action.onClick}>
                  {action.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Stack>
        </Stack>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            color={getProjectStageTone(project.summary.currentStage)}
            label={formatProjectStageLabel(project.summary.currentStage)}
          />
          <Chip size="small" label={formatDescriptionSourceLabel(project.summary.descriptionSource)} variant="outlined" />
          <Chip size="small" label={`next ${project.summary.nextAction}`} variant="outlined" />
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ minHeight: 60 }}>
          {project.summary.description}
        </Typography>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {project.summary.tags.map(tag => (
            <Chip key={tag} size="small" label={tag} variant="outlined" />
          ))}
        </Stack>

        <Divider />

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip size="small" label={`skills ${project.contentSummary.skills}`} />
          <Chip size="small" label={`agents ${project.contentSummary.agents}`} />
          <Chip size="small" label={`commands ${project.contentSummary.commands}`} />
          <Chip size="small" label={`changes ${project.contentSummary.changes}`} />
        </Stack>
      </Stack>
    </Paper>
  )
}

function CategoryLane({
  category,
  meta,
  projects,
  isDropTarget,
  onDeleteProject,
  onMoveProject,
  onOpenProject,
}: {
  category: string
  meta?: ProjectCategoryMeta
  projects: ProjectInfo[]
  isDropTarget: boolean
  onDeleteProject: (project: ProjectInfo) => void
  onMoveProject: (project: ProjectInfo) => void
  onOpenProject: (project: ProjectInfo) => void
}) {
  const sortable = useSortable({ id: categoryDragId(category) })
  const droppable = useDroppable({ id: laneDropId(category) })

  return (
    <Paper
      ref={sortable.setNodeRef}
      variant="outlined"
      sx={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        p: 1.5,
        borderRadius: 2,
        minHeight: 460,
        backgroundColor: isDropTarget ? 'rgba(25, 118, 210, 0.06)' : 'background.paper',
        borderColor: isDropTarget ? 'primary.main' : 'divider',
      }}
    >
      <Stack spacing={1.5} sx={{ height: '100%' }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            p: 1,
            borderRadius: 1.5,
            backgroundColor: sortable.isDragging ? 'rgba(17,24,39,0.05)' : 'rgba(17,24,39,0.02)',
          }}
        >
          <IconButton size="small" {...sortable.attributes} {...sortable.listeners}>
            <DragIndicatorRoundedIcon fontSize="small" />
          </IconButton>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {category}
              </Typography>
              {meta?.isDefault && <Chip size="small" label="default" color="primary" />}
              <Chip size="small" label={`${projects.length} projects`} variant="outlined" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {meta?.isDefault
                ? '새 프로젝트의 기본 시작 카테고리'
                : `보드 순서 ${typeof meta?.order === 'number' ? meta.order + 1 : '-'}`}
            </Typography>
          </Box>
        </Stack>

        <Divider />

        <Stack
          ref={droppable.setNodeRef}
          spacing={1.25}
          sx={{
            minHeight: 300,
            flex: 1,
            p: 0.25,
            borderRadius: 1,
            outline: isDropTarget ? '1px dashed' : 'none',
            outlineColor: 'primary.main',
          }}
        >
          {projects.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 1.5,
                borderStyle: 'dashed',
                backgroundColor: 'rgba(17,24,39,0.02)',
              }}
            >
              <Typography variant="subtitle2">Empty lane</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                프로젝트 카드를 이곳으로 드롭하면 이 카테고리로 이동합니다.
              </Typography>
            </Paper>
          ) : (
            projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={onDeleteProject}
                onMove={onMoveProject}
                onOpen={onOpenProject}
              />
            ))
          )}
        </Stack>
      </Stack>
    </Paper>
  )
}

export default function ProjectHome() {
  const navigate = useNavigate()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [data, setData] = useState<ProjectListResponse>(EMPTY_LIST)
  const [loading, setLoading] = useState(true)
  const [showAddProject, setShowAddProject] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [projectPath, setProjectPath] = useState('')
  const [projectCategory, setProjectCategory] = useState('home')
  const [moveCategory, setMoveCategory] = useState('home')
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null)
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null)
  const [activeDropCategory, setActiveDropCategory] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const nextData = await api.projects.list()
      setData(nextData)
      setProjectCategory(current => current || nextData.defaultCategory)
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

  const generatedDescriptions = useMemo(
    () => data.projects.filter(project => project.summary.descriptionSource === 'generated').length,
    [data.projects],
  )

  const groupedProjectsByCategory = useMemo(
    () => Object.fromEntries(data.groupedProjects.map(group => [group.category, group.projects])),
    [data.groupedProjects],
  )

  const handleAddProject = async () => {
    if (!projectPath.trim()) return
    setSubmitting(true)
    try {
      const result = await api.projects.add(projectPath.trim(), projectCategory || data.defaultCategory)
      setProjectPath('')
      setProjectCategory(data.defaultCategory)
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

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id)
    const category = parseCategoryDragId(activeId)
    if (category) {
      setActiveDrag({ type: 'category', category })
      return
    }

    const projectId = parseProjectDragId(activeId)
    const project = projectId ? data.projects.find(entry => entry.id === projectId) ?? null : null
    setActiveDrag(project ? { type: 'project', project } : null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (activeDrag?.type !== 'project') return
    setActiveDropCategory(resolveDropCategory(event.over ? String(event.over.id) : null, data.projects))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const overId = event.over ? String(event.over.id) : null

    try {
      if (activeDrag?.type === 'category') {
        const sourceCategory = activeDrag.category
        const targetCategory = parseCategoryDragId(overId)

        if (targetCategory && targetCategory !== sourceCategory) {
          const sourceIndex = data.categories.indexOf(sourceCategory)
          const targetIndex = data.categories.indexOf(targetCategory)
          if (sourceIndex !== -1 && targetIndex !== -1) {
            const nextCategories = arrayMove(data.categories, sourceIndex, targetIndex)
            const previousData = data
            setData(reorderDataCategories(previousData, nextCategories))
            try {
              await api.projects.reorderCategories(nextCategories)
            } catch (reorderError) {
              setData(previousData)
              setError(reorderError instanceof Error ? reorderError.message : '카테고리 정렬 저장 실패')
            }
          }
        }
      }

      if (activeDrag?.type === 'project') {
        const targetCategory = resolveDropCategory(overId, data.projects)
        if (targetCategory && targetCategory !== activeDrag.project.category) {
          const previousData = data
          setData(moveProjectCategoryInData(previousData, activeDrag.project.id, targetCategory))
          try {
            await api.projects.moveCategory(activeDrag.project.id, targetCategory)
          } catch (moveError) {
            setData(previousData)
            setError(moveError instanceof Error ? moveError.message : '카테고리 이동 실패')
          }
        }
      }
    } finally {
      setActiveDrag(null)
      setActiveDropCategory(null)
    }
  }

  const readCategoryMeta = (category: string): ProjectCategoryMeta | undefined =>
    data.categoryMeta.find(entry => entry.name === category)

  return (
    <Stack spacing={3}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 2,
          background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(29,78,216,0.88))',
          color: '#f8fafc',
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ color: 'rgba(248,250,252,0.72)' }}>
              Workspace overview
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5, color: '#f8fafc' }}>
              Project workspace hub
            </Typography>
            <Typography variant="body1" sx={{ mt: 1, maxWidth: 880, color: 'rgba(248,250,252,0.82)' }}>
              Jira 스타일의 overview를 참고해 프로젝트 상태, 카테고리, 기술/목적, 다음 액션을 한 보드에서 읽고 정리할 수 있도록 재구성했습니다.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 180, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', color: '#f8fafc' }}>
              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)' }}>등록 프로젝트</Typography>
              <Typography variant="h5">{data.projects.length}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 180, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', color: '#f8fafc' }}>
              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)' }}>카테고리</Typography>
              <Typography variant="h5">{data.categories.length}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 180, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', color: '#f8fafc' }}>
              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)' }}>자동 설명 초안</Typography>
              <Typography variant="h5">{generatedDescriptions}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 180, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', color: '#f8fafc' }}>
              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)' }}>표시 항목 합계</Typography>
              <Typography variant="h5">{totalContent}</Typography>
            </Paper>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button
              variant="contained"
              color="inherit"
              onClick={() => {
                setProjectCategory(data.defaultCategory)
                setShowAddProject(true)
              }}
              sx={{ color: '#0f172a' }}
            >
              프로젝트 추가
            </Button>
            <Button variant="outlined" onClick={() => navigate('/manage/categories')} sx={{ color: '#f8fafc', borderColor: 'rgba(248,250,252,0.28)' }}>
              Operations
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h6">Category board</Typography>
              <Typography variant="body2" color="text.secondary">
                lane 순서는 헤더 핸들로 재정렬하고, 카드 이동은 카드 핸들로 수행합니다.
              </Typography>
            </Box>
            <Chip size="small" label={`default ${data.defaultCategory}`} variant="outlined" />
          </Stack>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={event => { void handleDragEnd(event) }}
          >
            <SortableContext items={data.categories.map(categoryDragId)} strategy={horizontalListSortingStrategy}>
              <Box
                sx={{
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridAutoColumns: { xs: '88%', md: 'minmax(340px, 1fr)' },
                  gap: 2,
                  overflowX: 'auto',
                  pb: 1,
                }}
              >
                {data.categories.map(category => (
                  <CategoryLane
                    key={category}
                    category={category}
                    meta={readCategoryMeta(category)}
                    projects={groupedProjectsByCategory[category] ?? []}
                    isDropTarget={activeDropCategory === category}
                    onDeleteProject={project => void handleDeleteProject(project)}
                    onMoveProject={openMoveDialog}
                    onOpenProject={project => navigate(`/projects/${project.id}`)}
                  />
                ))}
              </Box>
            </SortableContext>

            <DragOverlay>
              {activeDrag?.type === 'category' ? (
                <ProjectDragPreview
                  title={activeDrag.category}
                  subtitle="카테고리 순서를 이동 중입니다."
                  chips={['lane reorder']}
                />
              ) : activeDrag?.type === 'project' ? (
                <ProjectDragPreview
                  title={activeDrag.project.name}
                  subtitle={activeDrag.project.summary.description}
                  chips={[
                    formatProjectStageLabel(activeDrag.project.summary.currentStage),
                    ...activeDrag.project.summary.tags.slice(0, 2),
                  ]}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
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
              value={projectCategory || data.defaultCategory}
              onChange={event => setProjectCategory(event.target.value)}
            >
              {(data.categories.length > 0 ? data.categories : [data.defaultCategory]).map(category => (
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
