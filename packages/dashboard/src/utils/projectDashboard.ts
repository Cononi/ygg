import type { ProjectCategoryGroup, ProjectContentType, TargetFileSource } from '../types'

export interface TargetFileItem {
  id: string
  target: string
  targetLabel: string
  type: Exclude<ProjectContentType, 'changes'>
  name: string
}

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

export function buildCategoryProjectCounts(groups: ProjectCategoryGroup[]): Record<string, number> {
  return Object.fromEntries(groups.map(group => [group.category, group.projects.length]))
}
