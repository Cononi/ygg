import type {
  AppliedInitSummary,
  ProjectFlowNode,
  ProjectFlowSnapshot,
  ProjectDescriptionSource,
  ProjectCategoryGroup,
  ProjectContentType,
  TargetFileSource,
} from '../types'
import type { Edge, Node } from '@xyflow/react'

export const PROJECT_CARD_ACTION_ORDER = ['move', 'delete'] as const

export interface TargetFileItem {
  id: string
  target: string
  targetLabel: string
  type: Exclude<ProjectContentType, 'changes'>
  name: string
}

export type TargetFilterValue = 'all' | string

export function flattenTargetFileItems(
  targets: TargetFileSource[],
  type: Exclude<ProjectContentType, 'changes'>,
): TargetFileItem[] {
  return targets.flatMap(target =>
    target.files[type].map(name => ({
      id: `${target.target}:${type}:${name}`,
      target: target.target,
      targetLabel: target.label,
      type,
      name,
    })),
  )
}

export function filterTargetFileItems(items: TargetFileItem[], target: TargetFilterValue): TargetFileItem[] {
  if (target === 'all') return items
  return items.filter(item => item.target === target)
}

export function buildCategoryProjectCounts(groups: ProjectCategoryGroup[]): Record<string, number> {
  return Object.fromEntries(groups.map(group => [group.category, group.projects.length]))
}

export function summarizeAppliedInits(appliedInits: AppliedInitSummary[], visibleCount = 3): {
  visible: AppliedInitSummary[]
  overflow: number
} {
  return {
    visible: appliedInits.slice(0, visibleCount),
    overflow: Math.max(0, appliedInits.length - visibleCount),
  }
}

export function hasMultipleTargets(targets: TargetFileSource[]): boolean {
  return targets.length > 1
}

export function formatProjectStageLabel(stage: string): string {
  switch (stage) {
    case 'complete':
      return 'complete'
    case 'setup':
      return 'setup'
    default:
      return stage || '—'
  }
}

export function getProjectStageTone(stage: string): 'success' | 'warning' | 'default' {
  if (stage === 'complete') return 'success'
  if (stage === 'setup') return 'default'
  return 'warning'
}

export function formatDescriptionSourceLabel(source: ProjectDescriptionSource): string {
  return source === 'manual' ? 'manual' : 'generated'
}

function getFlowNodeBorder(status: ProjectFlowNode['status']): string {
  switch (status) {
    case 'done':
      return '#2e7d32'
    case 'active':
      return '#1565c0'
    case 'pending':
      return '#9e9e9e'
    default:
      return '#6b7280'
  }
}

function getFlowNodeBackground(kind: ProjectFlowNode['kind']): string {
  switch (kind) {
    case 'summary':
      return 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(37,99,235,0.92))'
    case 'action':
      return 'linear-gradient(135deg, rgba(14,116,144,0.12), rgba(56,189,248,0.22))'
    case 'content':
      return 'linear-gradient(135deg, rgba(14,165,233,0.10), rgba(125,211,252,0.24))'
    default:
      return '#ffffff'
  }
}

function buildFlowNodeLabel(node: ProjectFlowNode): string {
  return node.meta && node.meta.length > 0
    ? `${node.label}\n${node.meta.join('\n')}`
    : node.label
}

export function buildProjectFlowElements(snapshot: ProjectFlowSnapshot): {
  nodes: Node[]
  edges: Edge[]
} {
  return {
    nodes: snapshot.nodes.map(node => ({
      id: node.id,
      position: node.position,
      draggable: false,
      selectable: false,
      data: { label: buildFlowNodeLabel(node) },
      style: {
        width: node.kind === 'summary' ? 220 : 190,
        minHeight: node.kind === 'summary' ? 100 : 78,
        whiteSpace: 'pre-wrap',
        fontWeight: node.kind === 'summary' ? 700 : 600,
        color: node.kind === 'summary' ? '#f8fafc' : '#0f172a',
        borderRadius: 18,
        border: `2px solid ${getFlowNodeBorder(node.status)}`,
        background: getFlowNodeBackground(node.kind),
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.10)',
        padding: 12,
      },
    })),
    edges: snapshot.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: edge.source.startsWith('stage:') && edge.target.startsWith('stage:'),
      style: { stroke: '#64748b', strokeWidth: 2 },
      labelStyle: { fill: '#334155', fontWeight: 600 },
    })),
  }
}
