export type VersionStatus = 'latest' | 'patch-behind' | 'minor-behind' | 'major-behind' | 'unknown'

export interface ProjectEntry {
  id: string
  path: string
  addedAt: string
  yggVersion: string
}

export interface ChangeStatus {
  total: number
  inProgress: number
  done: number
}

export interface ProjectInfo extends ProjectEntry {
  name: string
  currentVersion: string
  projectVersion: string
  versionStatus: VersionStatus
  latestReleaseVersion?: string
  latestReleaseDate?: string
  skillCount: number
  agentCount: number
  commandCount: number
  changeStatus: ChangeStatus
}

export interface ProjectDetail {
  info: ProjectInfo
  targets: TargetFiles[]
}

export interface TargetFiles {
  target: string
  label: string
  files: {
    skills: string[]
    agents: string[]
    commands: string[]
  }
}

export interface ChangeEntry {
  topic: string
  status: string
  stage: string
  yggPoint: string
  description: string
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
