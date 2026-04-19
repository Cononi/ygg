import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { ParsedChangeIndex } from '../core/change-index.js'
import { fileExists } from '../utils/file-writer.js'
import type { ProjectEntry } from './registry.js'
import type { TargetFileSource } from './target-files.js'

export type ProjectDescriptionSource = 'manual' | 'generated'

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

export interface ProjectFlowNodeSnapshot {
  id: string
  kind: 'summary' | 'stage' | 'document' | 'content' | 'action'
  label: string
  status: 'done' | 'active' | 'pending' | 'neutral'
  position: {
    x: number
    y: number
  }
  meta?: string[]
}

export interface ProjectFlowEdgeSnapshot {
  id: string
  source: string
  target: string
  label?: string
}

export interface ProjectFlowSnapshot {
  nodes: ProjectFlowNodeSnapshot[]
  edges: ProjectFlowEdgeSnapshot[]
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

interface ChangeTopicRef {
  topic: string
  stage: string
  description: string
  date?: string
  archive?: boolean
}

const STAGE_ORDER = ['create', 'next', 'add', 'qa'] as const

function normalizeStage(stage: string | undefined, hasArchivedTopic: boolean): string {
  const trimmed = stage?.trim() ?? ''
  if (trimmed) return trimmed
  return hasArchivedTopic ? 'complete' : 'setup'
}

function normalizeTopicDescription(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed && trimmed !== '-' ? trimmed : undefined
}

function humanizeCategory(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'home'
}

async function readProjectFile(projectPath: string, relativePath: string): Promise<string> {
  try {
    return await readFile(join(projectPath, relativePath), 'utf-8')
  } catch {
    return ''
  }
}

async function collectProjectSignals(projectPath: string): Promise<{
  hasPackageJson: boolean
  packageJson: string
  hasTsConfig: boolean
  hasPython: boolean
  pythonText: string
  hasSpring: boolean
  springText: string
}> {
  const [packageJson, hasTsConfig, requirements, pyproject, pom, gradle, gradleKts] = await Promise.all([
    readProjectFile(projectPath, 'package.json'),
    fileExists(join(projectPath, 'tsconfig.json')),
    readProjectFile(projectPath, 'requirements.txt'),
    readProjectFile(projectPath, 'pyproject.toml'),
    readProjectFile(projectPath, 'pom.xml'),
    readProjectFile(projectPath, 'build.gradle'),
    readProjectFile(projectPath, 'build.gradle.kts'),
  ])

  const springText = [pom, gradle, gradleKts].filter(Boolean).join('\n')
  const pythonText = [requirements, pyproject].filter(Boolean).join('\n')

  return {
    hasPackageJson: packageJson.length > 0,
    packageJson,
    hasTsConfig,
    hasPython: pythonText.length > 0,
    pythonText,
    hasSpring: springText.length > 0,
    springText,
  }
}

async function inferProjectTags(
  projectPath: string,
  entry: ProjectEntry,
  targets: TargetFileSource[],
  activeTopic: ChangeTopicRef | null,
  model: ParsedChangeIndex | null,
): Promise<string[]> {
  const signals = await collectProjectSignals(projectPath)
  const text = [
    entry.name,
    entry.path,
    entry.description,
    activeTopic?.description,
    ...((model?.topics ?? []).map(topic => topic.description)),
    ...((model?.archiveTopics ?? []).map(topic => topic.description)),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()

  const tags: string[] = []
  const push = (value: string) => {
    if (!tags.includes(value)) {
      tags.push(value)
    }
  }

  if (signals.hasPackageJson) push('Node.js')
  if (signals.hasTsConfig || /typescript|tsup|tsx|tsconfig/.test(signals.packageJson)) push('TypeScript')
  if (/["']react["']|react-dom|@mui\//.test(signals.packageJson)) push('React')
  if (/next/.test(signals.packageJson)) push('Next.js')
  if (signals.hasSpring && /spring-boot|springframework/.test(signals.springText.toLowerCase())) push('Spring Boot')
  if (signals.hasSpring && !tags.includes('Spring Boot')) push('Java')
  if (signals.hasPython) push('Python')
  if (/pdf|pypdf|pdfplumber|pdfbox/.test(`${text}\n${signals.pythonText.toLowerCase()}\n${signals.springText.toLowerCase()}`)) push('PDF Analysis')
  if (/dashboard|workspace/.test(text)) push('Dashboard')
  if (/workflow|ygg|change|pipeline/.test(text)) push('Workflow')

  if (tags.length === 0) {
    for (const target of targets) {
      push(target.label)
    }
  }

  if (tags.length === 0) {
    push(humanizeCategory(entry.category))
  }

  return tags.slice(0, 6)
}

function resolveTopic(model: ParsedChangeIndex | null): {
  activeTopic: ChangeTopicRef | null
  referenceTopic: ChangeTopicRef | null
} {
  const active = model?.topics[0]
  if (active) {
    return {
      activeTopic: {
        topic: active.topic,
        stage: active.stage,
        description: active.description,
        date: active.date,
      },
      referenceTopic: {
        topic: active.topic,
        stage: active.stage,
        description: active.description,
        date: active.date,
      },
    }
  }

  const archived = model?.archiveTopics[0]
  if (!archived) {
    return { activeTopic: null, referenceTopic: null }
  }

  return {
    activeTopic: null,
    referenceTopic: {
      topic: archived.topic,
      stage: 'complete',
      description: archived.description,
      date: archived.date,
      archive: true,
    },
  }
}

export function buildNextAction(stage: string, hasArchivedTopic: boolean): string {
  switch (stage) {
    case 'create':
      return 'design/spec/tasks를 정리합니다'
    case 'next':
      return '구현을 시작합니다'
    case 'add':
      return '구현을 마무리하고 QA를 준비합니다'
    case 'qa':
      return '검증 결과를 정리하고 마감합니다'
    case 'complete':
      return '새 change를 시작하거나 완료 이력을 검토합니다'
    default:
      return hasArchivedTopic ? '새 change를 시작하거나 완료 이력을 검토합니다' : '첫 change를 생성합니다'
  }
}

function buildStageReason(
  currentStage: string,
  activeTopic: ChangeTopicRef | null,
  hasArchivedTopic: boolean,
): string[] {
  if (activeTopic) {
    const reasons = [
      `live INDEX 기준 active topic은 ${activeTopic.topic}입니다.`,
      `${activeTopic.topic}의 단계가 ${activeTopic.stage}라서 프로젝트 stage를 ${currentStage}로 계산합니다.`,
    ]
    const description = normalizeTopicDescription(activeTopic.description)
    if (description) {
      reasons.push(`활성 작업 설명: ${description}`)
    }
    return reasons
  }

  if (hasArchivedTopic) {
    return [
      'live INDEX에서 active topic을 찾지 못했습니다.',
      'archive 이력이 남아 있어 현재 프로젝트를 complete 상태로 간주합니다.',
    ]
  }

  return [
    'live INDEX에서 active topic을 찾지 못했습니다.',
    'archive 이력도 없어서 아직 첫 change를 만들지 않은 setup 상태입니다.',
  ]
}

function buildNextActionReason(
  currentStage: string,
  activeTopic: ChangeTopicRef | null,
  hasArchivedTopic: boolean,
): string[] {
  switch (currentStage) {
    case 'create':
      return [
        activeTopic
          ? `${activeTopic.topic}이 create 단계이므로 다음은 design/spec/tasks 정리입니다.`
          : 'create 단계 준비 중입니다.',
      ]
    case 'next':
      return [
        activeTopic
          ? `${activeTopic.topic}이 next 단계이므로 구현을 시작할 차례입니다.`
          : 'next 단계 계획 문서가 준비되었습니다.',
      ]
    case 'add':
      return [
        activeTopic
          ? `${activeTopic.topic}이 add 단계이므로 구현 마무리와 QA 준비가 다음 순서입니다.`
          : '구현 마무리와 QA 준비가 다음 액션입니다.',
      ]
    case 'qa':
      return [
        activeTopic
          ? `${activeTopic.topic}이 qa 단계이므로 검증 결과를 정리하고 마감합니다.`
          : '검증 결과를 정리하고 마감합니다.',
      ]
    case 'complete':
      return hasArchivedTopic
        ? ['active topic은 없고 완료 이력만 남아 있어 새 change 시작 또는 완료 이력 검토가 다음 액션입니다.']
        : ['현재 active topic이 보이지 않아 상태를 다시 확인해야 합니다.']
    default:
      return hasArchivedTopic
        ? ['active topic은 없고 완료 이력만 남아 있습니다.']
        : ['진행 중인 change가 없어 첫 change 생성이 다음 액션입니다.']
  }
}

function buildGeneratedDescription(
  entry: ProjectEntry,
  tags: string[],
  currentStage: string,
  nextAction: string,
  activeTopic: ChangeTopicRef | null,
  hasArchivedTopic: boolean,
): string {
  const categoryLabel = humanizeCategory(entry.category)
  const tagLabel = tags.length > 0 ? tags.join(', ') : 'YGG workflow'
  const activeLabel = activeTopic?.description
    ? `현재는 ${activeTopic.description} 작업이 진행 중입니다.`
    : hasArchivedTopic
      ? '현재 진행 중인 change는 없고 완료 이력이 남아 있습니다.'
      : '아직 진행 중인 change가 없어 초기 정리가 필요합니다.'

  return `${categoryLabel} 카테고리의 ${tagLabel} 중심 프로젝트입니다. 현재 단계는 ${currentStage}이며, ${activeLabel} 다음 액션은 ${nextAction}입니다.`
}

export async function buildProjectDashboardSummary(params: {
  projectPath: string
  entry: ProjectEntry
  targets: TargetFileSource[]
  model: ParsedChangeIndex | null
}): Promise<ProjectDashboardSummary> {
  const { projectPath, entry, targets, model } = params
  const { activeTopic } = resolveTopic(model)
  const hasArchivedTopic = (model?.archiveTopics.length ?? 0) > 0
  const currentStage = normalizeStage(activeTopic?.stage, hasArchivedTopic)
  const stageReason = buildStageReason(currentStage, activeTopic, hasArchivedTopic)
  const nextAction = buildNextAction(currentStage, hasArchivedTopic)
  const nextActionReason = buildNextActionReason(currentStage, activeTopic, hasArchivedTopic)
  const tags = await inferProjectTags(projectPath, entry, targets, activeTopic, model)
  const manualDescription = entry.description?.trim()

  return {
    tags,
    description: manualDescription || buildGeneratedDescription(
      entry,
      tags,
      currentStage,
      nextAction,
      activeTopic,
      hasArchivedTopic,
    ),
    descriptionSource: manualDescription ? 'manual' : 'generated',
    currentStage,
    stageReason,
    nextAction,
    nextActionReason,
    activeTopic: activeTopic?.topic,
    activeTopicDescription: normalizeTopicDescription(activeTopic?.description),
    activeTargets: targets.map(target => ({ id: target.target, label: target.label })),
  }
}

function buildStageStatus(currentStage: string, hasArchivedTopic: boolean, stage: string): 'done' | 'active' | 'pending' | 'neutral' {
  if (currentStage === 'complete') return 'done'
  if (currentStage === 'setup') return 'pending'

  const currentIndex = STAGE_ORDER.indexOf(currentStage as typeof STAGE_ORDER[number])
  const targetIndex = STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number])

  if (currentIndex === -1 || targetIndex === -1) {
    return hasArchivedTopic ? 'neutral' : 'pending'
  }
  if (targetIndex < currentIndex) return 'done'
  if (targetIndex === currentIndex) return 'active'
  return 'pending'
}

function buildFlowSummaryMeta(summary: ProjectDashboardSummary, entry: ProjectEntry): string[] {
  const meta = [
    `Category: ${humanizeCategory(entry.category)}`,
    `Stage: ${summary.currentStage}`,
    `Next: ${summary.nextAction}`,
    'Source: live INDEX.md',
  ]

  if (summary.tags.length > 0) {
    meta.push(`Tags: ${summary.tags.join(', ')}`)
  }
  if (summary.activeTopic) {
    meta.push(`Topic: ${summary.activeTopic}`)
  }
  if (summary.stageReason.length > 0) {
    meta.push(`Why: ${summary.stageReason[0]}`)
  }

  return meta
}

function buildDocumentMeta(available: boolean, label: string, topicLabel?: string): string[] {
  if (!available) {
    return [`${label} 파일이 아직 없습니다.`]
  }

  return topicLabel
    ? [`${topicLabel} 흐름에서 사용할 수 있습니다.`]
    : [`${label} 파일을 읽을 수 있습니다.`]
}

export async function buildProjectFlowSnapshot(params: {
  projectPath: string
  entry: ProjectEntry
  model: ParsedChangeIndex | null
  targets: TargetFileSource[]
  contentSummary: {
    skills: number
    agents: number
    commands: number
    changes: number
  }
  summary: ProjectDashboardSummary
}): Promise<ProjectFlowSnapshot> {
  const { projectPath, entry, model, targets, contentSummary, summary } = params
  const { activeTopic, referenceTopic } = resolveTopic(model)
  const hasArchivedTopic = (model?.archiveTopics.length ?? 0) > 0
  const baseTopicPath = referenceTopic
    ? referenceTopic.archive
      ? join(projectPath, 'ygg', 'change', 'archive', referenceTopic.topic)
      : join(projectPath, 'ygg', 'change', referenceTopic.topic)
    : null

  const [hasProposal, hasDesign, hasTasks, hasSpecs] = await Promise.all([
    baseTopicPath ? fileExists(join(baseTopicPath, 'proposal.md')) : Promise.resolve(false),
    baseTopicPath ? fileExists(join(baseTopicPath, 'design.md')) : Promise.resolve(false),
    baseTopicPath ? fileExists(join(baseTopicPath, 'tasks.md')) : Promise.resolve(false),
    baseTopicPath ? fileExists(join(baseTopicPath, 'specs')) : Promise.resolve(false),
  ])

  const nodes: ProjectFlowNodeSnapshot[] = [
    {
      id: 'summary',
      kind: 'summary',
      label: entry.name,
      status: 'neutral',
      position: { x: 0, y: 0 },
      meta: buildFlowSummaryMeta(summary, entry),
    },
    ...STAGE_ORDER.map((stage, index) => ({
      id: `stage:${stage}`,
      kind: 'stage' as const,
      label: stage,
      status: buildStageStatus(summary.currentStage, hasArchivedTopic, stage),
      position: { x: index * 220, y: 180 },
      meta: activeTopic?.stage === stage
        ? [
            ...(summary.activeTopicDescription ? [summary.activeTopicDescription] : []),
            ...summary.stageReason.slice(0, 1),
          ]
        : undefined,
    })),
    {
      id: 'document:proposal',
      kind: 'document',
      label: 'proposal.md',
      status: hasProposal ? 'done' : 'pending',
      position: { x: 0, y: 360 },
      meta: buildDocumentMeta(hasProposal, 'proposal', referenceTopic?.topic),
    },
    {
      id: 'document:design',
      kind: 'document',
      label: 'design.md',
      status: hasDesign ? 'done' : 'pending',
      position: { x: 220, y: 360 },
      meta: buildDocumentMeta(hasDesign, 'design', referenceTopic?.topic),
    },
    {
      id: 'document:tasks',
      kind: 'document',
      label: 'tasks.md',
      status: hasTasks ? 'done' : 'pending',
      position: { x: 440, y: 360 },
      meta: buildDocumentMeta(hasTasks, 'tasks', referenceTopic?.topic),
    },
    {
      id: 'document:specs',
      kind: 'document',
      label: 'specs/',
      status: hasSpecs ? 'done' : 'pending',
      position: { x: 660, y: 360 },
      meta: buildDocumentMeta(hasSpecs, 'specs', referenceTopic?.topic),
    },
    {
      id: 'content',
      kind: 'content',
      label: 'Project content',
      status: contentSummary.changes > 0 ? 'active' : 'neutral',
      position: { x: 900, y: 180 },
      meta: [
        `skills ${contentSummary.skills}`,
        `agents ${contentSummary.agents}`,
        `commands ${contentSummary.commands}`,
        `changes ${contentSummary.changes}`,
        `applied init ${targets.length}`,
        `targets ${summary.activeTargets.map(target => target.label).join(', ') || 'none'}`,
      ],
    },
    {
      id: 'action',
      kind: 'action',
      label: 'Next action',
      status: 'active',
      position: { x: 900, y: 360 },
      meta: [
        summary.nextAction,
        ...summary.nextActionReason,
        summary.activeTopic ? `Active topic: ${summary.activeTopic}` : '진행 중인 active topic이 없습니다.',
      ],
    },
  ]

  const edges: ProjectFlowEdgeSnapshot[] = [
    { id: 'edge:summary:create', source: 'summary', target: 'stage:create' },
    { id: 'edge:create:next', source: 'stage:create', target: 'stage:next' },
    { id: 'edge:next:add', source: 'stage:next', target: 'stage:add' },
    { id: 'edge:add:qa', source: 'stage:add', target: 'stage:qa' },
    { id: 'edge:qa:action', source: 'stage:qa', target: 'action', label: 'handoff' },
    { id: 'edge:summary:content', source: 'summary', target: 'content' },
    { id: 'edge:content:action', source: 'content', target: 'action' },
    { id: 'edge:create:proposal', source: 'stage:create', target: 'document:proposal' },
    { id: 'edge:next:design', source: 'stage:next', target: 'document:design' },
    { id: 'edge:add:tasks', source: 'stage:add', target: 'document:tasks' },
    { id: 'edge:next:specs', source: 'stage:next', target: 'document:specs' },
  ]

  return {
    nodes,
    edges,
    legend: {
      currentStage: summary.currentStage,
      stageReason: summary.stageReason,
      nextAction: summary.nextAction,
      nextActionReason: summary.nextActionReason,
      activeTopic: summary.activeTopic,
      hasGeneratedDescription: summary.descriptionSource === 'generated',
      activeTargets: summary.activeTargets,
    },
  }
}
