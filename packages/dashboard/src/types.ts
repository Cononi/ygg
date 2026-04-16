export type VersionStatus = 'latest' | 'patch-behind' | 'minor-behind' | 'major-behind' | 'unknown'
export type ProjectContentType = 'skills' | 'agents' | 'commands' | 'changes'

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

export interface ProjectInfo extends ProjectEntry {
  currentVersion: string
  projectVersion: string
  versionStatus: VersionStatus
  contentSummary: ProjectContentSummary
  latestReleaseVersion?: string
  latestReleaseDate?: string
  changeStatus: {
    total: number
    inProgress: number
    done: number
  }
}

export interface ProjectCategoryGroup {
  category: string
  projects: ProjectInfo[]
}

export interface ProjectListResponse {
  categories: string[]
  projects: ProjectInfo[]
  groupedProjects: ProjectCategoryGroup[]
}

export interface ProjectDetail {
  info: ProjectInfo
  targets: TargetFileSource[]
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
