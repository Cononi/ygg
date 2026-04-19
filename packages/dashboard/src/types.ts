export type VersionStatus = 'latest' | 'patch-behind' | 'minor-behind' | 'major-behind' | 'unknown'
export type ProjectContentType = 'skills' | 'agents' | 'commands' | 'changes'
export type ProjectDescriptionSource = 'manual' | 'generated'
export type ProjectFlowNodeKind = 'summary' | 'stage' | 'document' | 'content' | 'action'
export type ProjectFlowNodeStatus = 'done' | 'active' | 'pending' | 'neutral'

export interface ProjectEntry {
  id: string
  path: string
  name: string
  category: string
  description?: string
  createdAt: string
  updatedAt: string
  yggVersion: string
}

export interface ProjectContentSummary {
  skills: number
  agents: number
  commands: number
  changes: number
}

export interface ChangeStatus {
  total: number
  inProgress: number
  done: number
}

export interface ProjectDashboardSummary {
  tags: string[]
  description: string
  descriptionSource: ProjectDescriptionSource
  currentStage: string
  stageReason: string[]
  nextAction: string
  nextActionReason: string[]
  activeTopic?: string
  activeTopicDescription?: string
  activeTargets: Array<{
    id: string
    label: string
  }>
}

export interface ProjectFlowNode {
  id: string
  kind: ProjectFlowNodeKind
  label: string
  status: ProjectFlowNodeStatus
  position: {
    x: number
    y: number
  }
  meta?: string[]
}

export interface ProjectFlowEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface ProjectFlowSnapshot {
  nodes: ProjectFlowNode[]
  edges: ProjectFlowEdge[]
  legend: {
    currentStage: string
    stageReason: string[]
    nextAction: string
    nextActionReason: string[]
    activeTopic?: string
    hasGeneratedDescription: boolean
    activeTargets: Array<{
      id: string
      label: string
    }>
  }
}

export interface ProjectInfo extends ProjectEntry {
  currentVersion: string
  projectVersion: string
  versionStatus: VersionStatus
  contentSummary: ProjectContentSummary
  summary: ProjectDashboardSummary
  latestReleaseVersion?: string
  latestReleaseDate?: string
  changeStatus: ChangeStatus
}

export interface ProjectCategoryGroup {
  category: string
  projects: ProjectInfo[]
}

export interface ProjectCategoryMeta {
  name: string
  order: number
  isDefault: boolean
  projectCount: number
}

export interface ProjectListResponse {
  categories: string[]
  defaultCategory: string
  categoryMeta: ProjectCategoryMeta[]
  projects: ProjectInfo[]
  groupedProjects: ProjectCategoryGroup[]
}

export interface AppliedInitSummary {
  id: string
  label: string
}

export interface ProjectDetailInfo extends ProjectInfo {
  appliedInits: AppliedInitSummary[]
}

export interface ProjectDetail {
  info: ProjectDetailInfo
  targets: TargetFileSource[]
  flowSnapshot: ProjectFlowSnapshot
}

export interface TargetFileCollections {
  skills: string[]
  agents: string[]
  commands: string[]
}

export interface TargetFileSource {
  target: string
  label: string
  files: TargetFileCollections
}

export interface ProjectContentEntry {
  id: string
  projectId: string
  type: ProjectContentType
  title: string
  bodyMarkdown: string
  createdAt: string
  updatedAt: string
}

export interface PagedProjectContent {
  items: ProjectContentEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ChangeEntry {
  topic: string
  status: string
  stage: string
  yggPoint: string
  description: string
  type?: string
  version?: string
  latest?: string
  date?: string
}

export type ChangeField = 'status' | 'stage'
export const ARCHIVE_STATUS_LABEL = 'Archived'

export const YGG_STAGES = ['create', 'next', 'add', 'qa', 'teams', 'prove', '—'] as const
export type YggStage = typeof YGG_STAGES[number]

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

export interface TopicDetailResponse {
  topic: string
  files: FileNode[]
}

export interface ChangesResponse {
  topics: ChangeEntry[]
  archiveTopics: ChangeEntry[]
}
