import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { readChangeIndex, writeChangeIndex } from '../core/change-index.js'
import { createStageDefinition } from '../core/dimensions/create.js'
import { createYggPointDocument, YggPointEngine } from '../core/ygg-point.js'
import { readConfigYggPointAutoMode, writeConfigYggPointAutoMode } from '../i18n/config.js'
import type { YggPointAutoMode, YggPointQuestion } from '../types/ygg-point.js'
import { fileExists } from '../utils/file-writer.js'
import { promptInput, selectOption } from '../utils/interactive.js'
import { logger } from '../utils/logger.js'
import { runNext, type NextDependencies } from './next.js'

export interface CreateOptions {
  description?: string
}

export interface CreateDependencies {
  askQuestion?: (question: string) => Promise<string | null>
  selectOption?: (prompt: string, options: readonly { value: string; label: string }[]) => Promise<string | null>
  now?: () => Date
  runNext?: (projectRoot: string, deps?: NextDependencies) => Promise<void>
}

function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function slugifyTopic(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')

  return normalized || 'new-topic'
}

function deriveTopicName(description: string): string {
  const firstMeaningfulLine = description
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? description

  const topicSeed = firstMeaningfulLine.includes(':')
    ? firstMeaningfulLine.split(':').slice(1).join(':').trim()
    : firstMeaningfulLine

  return slugifyTopic(topicSeed.slice(0, 80))
}

async function ensureWorkspace(projectRoot: string): Promise<void> {
  const changeRoot = join(projectRoot, 'ygg', 'change')
  await mkdir(join(changeRoot, 'archive'), { recursive: true })

  const indexPath = join(changeRoot, 'INDEX.md')
  if (!await fileExists(indexPath)) {
    const initialIndex = [
      '# Change Index',
      '',
      '| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |',
      '|---|---|---|---|---|---|',
      '',
      '### Archive',
      '| 토픽 | 설명 | 유형 | 버전 | 최신 | 날짜 |',
      '|---|---|---|---|---|---|',
      '',
    ].join('\n')
    await writeFile(indexPath, initialIndex, 'utf-8')
  }
}

async function ensureTopicAvailable(topicDir: string): Promise<void> {
  try {
    const info = await stat(topicDir)
    if (info.isDirectory()) {
      throw new Error(`Topic already exists: ${topicDir}`)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }
    throw error
  }
}

function splitSourceText(input: string): Record<string, string> {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const findLine = (patterns: RegExp[]): string | undefined =>
    lines.find((line) => patterns.some((pattern) => pattern.test(line)))

  return {
    motivation: findLine([/^왜\b/, /^why\b/i, /필요/, /문제/]) ?? input,
    scope: findLine([/^범위\b/, /^scope\b/i, /대상/, /모듈/, /파일/]) ?? input,
    userStory: findLine([/^사용자\b/, /^user\b/i, /시나리오/, /workflow/i]) ?? input,
    boundary: findLine([/^제외\b/, /^boundary\b/i, /non-goal/i, /하지 않/]) ?? '명시된 비목표는 추가 질답 결과를 따른다.',
    impact: findLine([/^영향\b/, /^impact\b/i, /파일/, /모듈/, /시스템/]) ?? input,
  }
}

function collectAnswersByDimension(engine: YggPointEngine): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  for (const entry of engine.getHistory()) {
    if (!grouped[entry.dimension]) {
      grouped[entry.dimension] = []
    }
    grouped[entry.dimension]?.push(entry.answer)
  }
  return grouped
}

function uniqueLines(lines: Array<string | undefined>): string[] {
  return Array.from(new Set(lines.filter((line): line is string => Boolean(line && line.trim()))))
}

function renderCapabilities(source: Record<string, string>, groupedAnswers: Record<string, string[]>): string {
  const newItems = uniqueLines([
    source.scope,
    groupedAnswers['scope']?.[0],
    groupedAnswers['user-story']?.[0],
  ])
  const modifiedItems = uniqueLines([
    source.userStory,
    groupedAnswers['impact']?.[0],
    groupedAnswers['boundary']?.[0],
  ])

  return [
    '## Capabilities',
    '',
    '### New',
    ...newItems.map((item) => `- ${item}`),
    '',
    '### Modified',
    ...modifiedItems.map((item) => `- ${item}`),
  ].join('\n')
}

function synthesizeProposalMarkdown(input: string, engine: YggPointEngine): string {
  const source = splitSourceText(input)
  const groupedAnswers = collectAnswersByDimension(engine)

  const whyLines = uniqueLines([source.motivation, ...(groupedAnswers['motivation'] ?? [])])
  const whatChangeLines = uniqueLines([
    source.scope,
    ...(groupedAnswers['scope'] ?? []),
    ...(groupedAnswers['user-story'] ?? []),
  ])
  const impactLines = uniqueLines([source.impact, ...(groupedAnswers['impact'] ?? [])])
  const boundaryLines = uniqueLines([source.boundary, ...(groupedAnswers['boundary'] ?? [])])

  return [
    '# Proposal',
    '',
    '## Why',
    ...whyLines.map((line) => `- ${line}`),
    '',
    '## What Changes',
    ...whatChangeLines.map((line) => `- ${line}`),
    '',
    renderCapabilities(source, groupedAnswers),
    '',
    '## Impact',
    ...impactLines.map((line) => `- ${line}`),
    '',
    '## Boundary',
    ...boundaryLines.map((line) => `- ${line}`),
    '',
  ].join('\n')
}

function formatEvaluatorLabel(evaluatorType: string): string {
  const labels: Record<string, string> = {
    base: '핵심 정의',
    humanistic: '사용자 관점',
    domain: '도메인 관점',
    reference: '참고 근거',
    consistency: '기존 흐름 정합성',
  }
  return labels[evaluatorType] ?? evaluatorType
}

function buildQuestionPrompt(question: YggPointQuestion, round: number, score: number): string {
  const dimension = createStageDefinition.dimensions.find((entry) => entry.name === question.dimension)
  const hint = dimension?.completionHint ?? '답변이 구체적일수록 proposal 품질이 올라갑니다.'

  return [
    `현재 명확도 ${score.toFixed(2)} / 목표 0.95`,
    `[Round ${round}] ${question.dimensionDisplayName} · ${formatEvaluatorLabel(question.evaluatorType)}`,
    question.question,
    '',
    `왜 이 질문이 중요한가: ${hint}`,
    '',
    '답변: ',
  ].join('\n')
}

async function resolveAutoMode(
  projectRoot: string,
  askQuestion: (question: string) => Promise<string | null>,
  customSelect?: (prompt: string, options: readonly { value: string; label: string }[]) => Promise<string | null>,
): Promise<YggPointAutoMode> {
  const saved = await readConfigYggPointAutoMode(projectRoot)
  if (saved === 'on' || saved === 'off') {
    return saved
  }

  const selected = await selectOption(
    'YGG Point auto-mode를 선택하세요. create 단계에서만 적용됩니다.',
    [
      { value: 'on', label: '1. on (Recommended) — 코드/문서로 확인 가능한 항목은 자동 반영' },
      { value: 'off', label: '2. off — 모든 확인 포인트를 대화형 질문으로 진행' },
    ],
    askQuestion,
    customSelect,
  )

  const mode: YggPointAutoMode = selected === 'off' ? 'off' : 'on'
  await writeConfigYggPointAutoMode(projectRoot, mode)
  return mode
}

export async function runCreate(
  projectRoot: string,
  options: CreateOptions = {},
  deps: CreateDependencies = {},
): Promise<void> {
  await ensureWorkspace(projectRoot)

  const askQuestion = deps.askQuestion ?? promptInput
  let description = options.description?.trim()

  if (!description) {
    if (!process.stdin.isTTY && !deps.askQuestion) {
      throw new Error('Description is required when stdin is not a TTY')
    }
    description = await askQuestion('변경 설명을 입력하세요: ') ?? undefined
  }

  if (!description) {
    throw new Error('Change description is required')
  }

  const topic = deriveTopicName(description)
  const topicDir = join(projectRoot, 'ygg', 'change', topic)
  await ensureTopicAvailable(topicDir)

  const autoMode = await resolveAutoMode(projectRoot, askQuestion, deps.selectOption)
  const engine = new YggPointEngine(createStageDefinition)

  let loopResult = engine.runQuestionLoop(description, { autoMode })
  logger.info(YggPointEngine.formatScore(loopResult.result, engine.getThreshold()))

  while (!loopResult.result.ready) {
    const nextQuestion = engine.getNextQuestion(description)
    if (!nextQuestion) {
      break
    }

    let answer: string | null = null
    while (!answer) {
      answer = await askQuestion(buildQuestionPrompt(
        nextQuestion,
        engine.getHistory().length + 1,
        loopResult.result.score,
      ))

      if (!answer) {
        logger.warn('답변이 있어야 proposal 품질을 올릴 수 있습니다.')
      }
    }

    engine.addAnswer(nextQuestion, answer, 'user')
    loopResult = engine.runQuestionLoop(description, { autoMode })
    logger.info(YggPointEngine.formatScore(loopResult.result, engine.getThreshold()))
  }

  const now = deps.now?.() ?? new Date()
  const date = formatDate(now)
  await mkdir(topicDir, { recursive: true })

  const proposal = synthesizeProposalMarkdown(description, engine)
  const yggPointDocument = createYggPointDocument({
    topic,
    date,
    requestText: description,
    archiveType: 'feat',
    currentStage: 'create',
    stageDef: createStageDefinition,
    userInput: description,
    history: engine.getHistory(),
  })

  await writeFile(join(topicDir, 'proposal.md'), proposal, 'utf-8')
  await writeFile(join(topicDir, 'ygg-point.json'), JSON.stringify(yggPointDocument, null, 2) + '\n', 'utf-8')

  const index = await readChangeIndex(projectRoot)
  index.topics = index.topics.filter((entry) => entry.topic !== topic)
  index.topics.push({
    topic,
    status: '🔄 진행중',
    stage: 'create',
    yggPoint: yggPointDocument.score.toFixed(2),
    description,
    date,
  })
  await writeChangeIndex(projectRoot, index)

  logger.success(`Created proposal topic: ${topic}`)

  const continueOption = await selectOption(
    '다음 단계로 진행할까요?',
    [
      { value: 'next', label: '1. ygg-next 실행 (Recommended) — design/spec/tasks 생성으로 계속 진행' },
      { value: 'stop', label: '2. 여기서 멈춤 — proposal/create stage까지만 저장' },
    ],
    askQuestion,
    deps.selectOption,
  )

  if (continueOption === 'next') {
    const runNextImpl = deps.runNext ?? runNext
    await runNextImpl(projectRoot, {
      now: deps.now,
      selectOption: deps.selectOption,
    })
  }
}
