import type { ChangeEntry, ChangesResponse, ChangeStatus } from '../types'

export type ProjectDetailTab = 'skills' | 'agents' | 'commands' | 'changes'
export type ChangesSubTab = 'active' | 'archive'

export const DEFAULT_CHANGE_STATUS: ChangeStatus = {
  inProgress: 0,
  done: 0,
  total: 0,
}

export interface LatestRequestGuard {
  begin: () => number
  isCurrent: (requestId: number) => boolean
}

export interface ChangesSnapshotView {
  activeCount: number
  completedCount: number
  totalCount: number
  activeRows: Array<ChangeEntry & { id: string }>
  archiveRows: Array<ChangeEntry & { id: string }>
  isCompletelyEmpty: boolean
  activeEmpty: boolean
  archiveEmpty: boolean
  latestArchiveVersion?: string
}

export function buildChangeSummary(data: ChangesResponse): ChangeStatus {
  return {
    inProgress: data.topics.length,
    done: data.archiveTopics.length,
    total: data.topics.length + data.archiveTopics.length,
  }
}

function formatSnapshotVersion(version?: string): string | undefined {
  const raw = version && version !== '-' ? version.trim() : ''
  if (!raw) return undefined
  return raw.startsWith('v') ? raw : `v${raw}`
}

export function buildChangesSnapshotView(data: ChangesResponse): ChangesSnapshotView {
  const activeRows = data.topics.map(topic => ({ id: topic.topic, ...topic }))
  const archiveRows = data.archiveTopics.map(topic => ({ id: topic.topic, ...topic }))
  const latestArchive = data.archiveTopics.find(topic => topic.latest === 'latest')

  return {
    activeCount: activeRows.length,
    completedCount: archiveRows.length,
    totalCount: activeRows.length + archiveRows.length,
    activeRows,
    archiveRows,
    isCompletelyEmpty: activeRows.length === 0 && archiveRows.length === 0,
    activeEmpty: activeRows.length === 0,
    archiveEmpty: archiveRows.length === 0,
    latestArchiveVersion: formatSnapshotVersion(latestArchive?.version),
  }
}

export function resolveProjectDetailChangeStatus(
  changesSummary: ChangeStatus | null,
  fallbackSummary: ChangeStatus,
): ChangeStatus {
  if (!changesSummary) return fallbackSummary

  // Prefer the live changes response when it contains real counts. If it comes
  // back as all-zero while project detail already has normalized counts, keep
  // the non-zero fallback to avoid rendering a permanently empty summary.
  if (changesSummary.total === 0 && fallbackSummary.total > 0) {
    return fallbackSummary
  }

  return changesSummary
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let currentRequestId = 0

  return {
    begin: () => {
      currentRequestId += 1
      return currentRequestId
    },
    isCurrent: (requestId: number) => requestId === currentRequestId,
  }
}

export function createProjectDetailResetState(): {
  tab: ProjectDetailTab
  target: string
  changeStatus: ChangeStatus
} {
  return {
    tab: 'skills',
    target: '',
    changeStatus: DEFAULT_CHANGE_STATUS,
  }
}

export function createChangesResetState(initialSubTab: ChangesSubTab = 'active'): {
  subTab: ChangesSubTab
  editingStage: string | null
} {
  return {
    subTab: initialSubTab,
    editingStage: null,
  }
}
