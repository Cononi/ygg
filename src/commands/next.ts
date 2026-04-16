import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { readChangeIndex, writeChangeIndex } from '../core/change-index.js'
import { nextStageDefinition } from '../core/dimensions/next.js'
import { createYggPointDocument, YggPointEngine } from '../core/ygg-point.js'
import type { YggPointDocument } from '../types/ygg-point.js'
import { promptInput, selectOption } from '../utils/interactive.js'
import { logger } from '../utils/logger.js'
import { runAdd, type AddDependencies } from './add.js'

export interface NextDependencies {
  now?: () => Date
  selectOption?: (prompt: string, options: readonly { value: string; label: string }[]) => Promise<string | null>
  runAdd?: (projectRoot: string, deps?: AddDependencies) => Promise<void>
}

function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function collectCreateTrailAnswers(existingYggPoint: YggPointDocument | null): Record<string, string[]> {
  const dimensions = existingYggPoint?.stages?.create?.dimensions ?? {}
  return Object.fromEntries(
    Object.entries(dimensions).map(([dimensionName, detail]) => [
      dimensionName,
      (detail.questionTrail ?? []).map((entry) => entry.answer),
    ]),
  )
}

function compactMarkdownText(input: string): string[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function uniqueLines(lines: Array<string | undefined>): string[] {
  return Array.from(new Set(lines.filter((line): line is string => Boolean(line && line.trim()))))
}

function synthesizeDesignMarkdown(
  topic: string,
  requestText: string,
  proposal: string,
  existingYggPoint: YggPointDocument | null,
): string {
  const createAnswers = collectCreateTrailAnswers(existingYggPoint)
  const proposalLines = compactMarkdownText(proposal)
  const engine = new YggPointEngine(nextStageDefinition)
  const stageInput = [requestText, proposal].filter(Boolean).join('\n\n')
  const score = engine.evaluate(stageInput)
  const scoreMap = Object.fromEntries(score.breakdown.map((entry) => [entry.name, entry.score])) as Record<string, number>

  return [
    `# Design: ${topic}`,
    '',
    '## Context',
    `- ${requestText}`,
    ...uniqueLines([
      proposalLines.find((line) => line.startsWith('- ')),
      createAnswers['motivation']?.[0],
      createAnswers['scope']?.[0],
    ]).map((line) => `- ${line}`),
    '',
    '## Goals',
    ...uniqueLines([
      createAnswers['scope']?.[0],
      createAnswers['user-story']?.[0],
      'proposal에서 확정한 요구를 구현 가능한 계획으로 바꾼다.',
    ]).map((line) => `- ${line}`),
    '',
    '## Non-Goals',
    ...uniqueLines([
      createAnswers['boundary']?.[0],
      'create 단계에서 확정하지 않은 신규 요구를 추가하지 않는다.',
    ]).map((line) => `- ${line}`),
    '',
    '## Decisions',
    `- 구현 구조(score ${scoreMap['architecture']?.toFixed(2) ?? '0.00'}): proposal 범위를 기준으로 모듈 경계를 유지하면서 최소 수정 경로를 택한다.`,
    `- 선택의 이유(score ${scoreMap['tradeoff']?.toFixed(2) ?? '0.00'}): 기존 흐름과의 일관성을 우선하고, 문서/테스트 정합성을 함께 맞춘다.`,
    `- 지켜야 할 제약(score ${scoreMap['constraint']?.toFixed(2) ?? '0.00'}): requestText와 create 질문 이력에서 확인된 범위를 넘기지 않는다.`,
    `- 구현 순서(score ${scoreMap['dependency']?.toFixed(2) ?? '0.00'}): 문서 계약 → 코드 변경 → 검증 순서로 진행한다.`,
    `- 롤백(score ${scoreMap['rollback']?.toFixed(2) ?? '0.00'}): 단계별 파일 단위로 되돌릴 수 있게 작업을 쪼갠다.`,
    '',
    '## Constraints',
    ...uniqueLines([
      createAnswers['impact']?.[0],
      'ygg-point.json은 initial request와 차원별 round trail을 유지해야 한다.',
      'next 단계에서는 추가 질문 없이 create에서 누적된 데이터만 사용한다.',
    ]).map((line) => `- ${line}`),
    '',
    '## Risks / Trade-offs',
    '- create 질문 품질이 낮으면 design 품질도 같이 낮아지므로 create trail을 source of truth로 본다.',
    '- 새 질문 없이 생성하므로 next는 보강보다 정리와 구조화에 집중한다.',
    '',
    '## Migration Plan',
    '- 1. proposal과 create ygg-point를 바탕으로 설계 문서 구조를 확정한다.',
    '- 2. spec과 tasks를 같은 범위 기준으로 생성한다.',
    '- 3. add/qa가 바로 실행 가능한 순서로 정리한다.',
    '',
    '## Open Questions',
    '- 없음. next 단계는 create에서 확보한 정보만 사용한다.',
    '',
  ].join('\n')
}

function synthesizeSpecMarkdown(
  topic: string,
  requestText: string,
  existingYggPoint: YggPointDocument | null,
): string {
  const createAnswers = collectCreateTrailAnswers(existingYggPoint)

  return [
    `# Spec: ${topic}`,
    '',
    '## Requirements',
    '- [ ] next 단계는 create에서 축적한 초기 요청과 round trail만으로 design/spec/tasks를 생성해야 한다.',
    '- [ ] next 단계는 사용자에게 추가 질문하지 않는다.',
    '- [ ] proposal, design, tasks의 범위는 create에서 확정된 scope/boundary를 넘지 않는다.',
    '- [ ] ygg-point.json은 top-level requestText를 유지하고, next stage snapshot을 추가한다.',
    '- [ ] dashboard는 각 차원의 질문/답변 이력을 조회할 수 있어야 한다.',
    '',
    '## Constraints',
    ...uniqueLines([
      requestText,
      createAnswers['boundary']?.[0],
      createAnswers['impact']?.[0],
    ]).map((line) => `- ${line}`),
    '',
    '## Interface',
    '- Input: proposal.md + create ygg-point.json',
    '- Output: design.md + specs/spec-core/spec.md + tasks.md + updated ygg-point.json',
    '',
  ].join('\n')
}

function synthesizeTasksMarkdown(existingYggPoint: YggPointDocument | null): string {
  const createAnswers = collectCreateTrailAnswers(existingYggPoint)

  return [
    '# Tasks',
    '',
    '1. create에서 확정된 요청과 범위를 기준으로 설계 문서를 정리한다.',
    `- [ ] Why/What Changes/${createAnswers['scope']?.[0] ? 'Impact' : 'Boundary'}를 반영해 design.md를 생성한다.`,
    '',
    '2. 구현 계약을 문서화한다.',
    '- [ ] specs/spec-core/spec.md를 생성한다.',
    '- [ ] add 단계가 바로 구현할 수 있게 tasks.md를 정리한다.',
    '',
    '3. ygg-point와 index를 갱신한다.',
    '- [ ] next stage snapshot을 저장한다.',
    '- [ ] INDEX.md stage를 next로 바꾼다.',
    '',
    '4. verification',
    '- [ ] 관련 unit test와 build/typecheck를 실행한다.',
    '',
  ].join('\n')
}

async function findActiveCreateTopic(projectRoot: string): Promise<{ topic: string; description: string } | null> {
  const index = await readChangeIndex(projectRoot)
  const candidates = index.topics
    .filter((entry) => entry.stage === 'create')
    .sort((a, b) => b.date.localeCompare(a.date) || a.topic.localeCompare(b.topic))

  const selected = candidates[0]
  return selected ? { topic: selected.topic, description: selected.description } : null
}

async function readExistingYggPoint(topicDir: string): Promise<YggPointDocument | null> {
  try {
    const content = await readFile(join(topicDir, 'ygg-point.json'), 'utf-8')
    return JSON.parse(content) as YggPointDocument
  } catch {
    return null
  }
}

async function ensureTopicDirectory(path: string): Promise<void> {
  const info = await stat(path)
  if (!info.isDirectory()) {
    throw new Error(`Topic path is not a directory: ${path}`)
  }
}

export async function runNext(
  projectRoot: string,
  deps: NextDependencies = {},
): Promise<void> {
  const activeTopic = await findActiveCreateTopic(projectRoot)
  if (!activeTopic) {
    throw new Error('No active create-stage topic found. Run ygg create first.')
  }

  const topicDir = join(projectRoot, 'ygg', 'change', activeTopic.topic)
  await ensureTopicDirectory(topicDir)

  const proposal = await readFile(join(topicDir, 'proposal.md'), 'utf-8')
  const existingYggPoint = await readExistingYggPoint(topicDir)
  const requestText = existingYggPoint?.requestText ?? activeTopic.description
  const stageInput = [requestText, proposal].filter(Boolean).join('\n\n')
  const now = deps.now?.() ?? new Date()
  const date = formatDate(now)
  const specDir = join(topicDir, 'specs', 'spec-core')
  await mkdir(specDir, { recursive: true })

  const design = synthesizeDesignMarkdown(activeTopic.topic, requestText, proposal, existingYggPoint)
  const spec = synthesizeSpecMarkdown(activeTopic.topic, requestText, existingYggPoint)
  const tasks = synthesizeTasksMarkdown(existingYggPoint)
  const yggPointDocument = createYggPointDocument({
    topic: activeTopic.topic,
    date,
    requestText,
    currentStage: 'next',
    archiveType: existingYggPoint?.archiveType ?? 'feat',
    stageDef: nextStageDefinition,
    userInput: stageInput,
    history: [],
    existingDocument: existingYggPoint ?? undefined,
  })

  await writeFile(join(topicDir, 'design.md'), design, 'utf-8')
  await writeFile(join(specDir, 'spec.md'), spec, 'utf-8')
  await writeFile(join(topicDir, 'tasks.md'), tasks, 'utf-8')
  await writeFile(join(topicDir, 'ygg-point.json'), JSON.stringify(yggPointDocument, null, 2) + '\n', 'utf-8')

  const index = await readChangeIndex(projectRoot)
  index.topics = index.topics.filter((entry) => entry.topic !== activeTopic.topic)
  index.topics.push({
    topic: activeTopic.topic,
    status: '🔄 진행중',
    stage: 'next',
    yggPoint: yggPointDocument.score.toFixed(2),
    description: requestText,
    date,
  })
  await writeChangeIndex(projectRoot, index)

  logger.success(`Created next-stage documents for topic: ${activeTopic.topic}`)

  const continueOption = await selectOption(
    '다음 단계로 진행할까요?',
    [
      { value: 'add', label: '1. ygg-add 실행 (Recommended) — 구현 단계로 이동' },
      { value: 'stop', label: '2. 여기서 멈춤 — next stage 문서만 생성' },
    ],
    promptInput,
    deps.selectOption,
  )

  if (continueOption === 'add') {
    const runAddImpl = deps.runAdd ?? runAdd
    await runAddImpl(projectRoot, {
      now: deps.now,
      selectOption: deps.selectOption,
    })
  }
}
