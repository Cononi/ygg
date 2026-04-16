import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as readline from 'node:readline'

import { readChangeIndex, writeChangeIndex } from '../core/change-index.js'
import { createStageDefinition } from '../core/dimensions/create.js'
import { createYggPointDocument, YggPointEngine } from '../core/ygg-point.js'
import { readConfigYggPointAutoMode } from '../i18n/config.js'
import type { YggPointQuestion } from '../types/ygg-point.js'
import { fileExists } from '../utils/file-writer.js'
import { logger } from '../utils/logger.js'

export interface CreateOptions {
  description?: string
}

interface CreateSelectOption {
  readonly value: string
  readonly label: string
}

export interface CreateDependencies {
  askQuestion?: (question: string) => Promise<string | null>
  selectOption?: (prompt: string, options: readonly CreateSelectOption[]) => Promise<string | null>
  now?: () => Date
}

const DEFAULT_CREATE_ROUND_LIMIT = 5
const MIN_MANUAL_QUESTIONS_PER_DIMENSION = 5
const QUESTION_MENU_LIMIT = 5

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

async function promptInput(question: string): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim() || null)
    })
    rl.on('close', () => resolve(null))
  })
}

async function arrowKeySelect(
  options: readonly CreateSelectOption[],
): Promise<string | null> {
  if (options.length === 0) return null

  let index = 0

  const renderMenu = () => {
    process.stdout.write(`\x1B[${options.length}A\x1B[0J`)
    for (let i = 0; i < options.length; i++) {
      const marker = i === index ? '▶' : ' '
      const option = options[i]
      if (option) process.stdout.write(`  ${marker} ${option.label}\n`)
    }
  }

  for (const option of options) {
    process.stdout.write(`    ${option.label}\n`)
  }
  renderMenu()

  return new Promise((resolve) => {
    const stdin = process.stdin
    stdin.setRawMode?.(true)
    stdin.resume()

    const onData = (buf: Buffer) => {
      const b0 = buf[0]
      const b1 = buf[1]
      const b2 = buf[2]

      if (b0 === 0x03 || b0 === 0x71) {
        cleanup()
        resolve(null)
        return
      }

      if (b0 === 0x0D || b0 === 0x0A) {
        cleanup()
        resolve(options[index]?.value ?? null)
        return
      }

      if (b0 >= 0x31 && b0 <= 0x39) {
        const numericIndex = b0 - 0x31
        if (numericIndex < options.length) {
          cleanup()
          resolve(options[numericIndex]?.value ?? null)
          return
        }
      }

      if (b0 === 0x1B && b1 === 0x5B && b2 === 0x41) {
        index = (index - 1 + options.length) % options.length
        renderMenu()
        return
      }

      if (b0 === 0x1B && b1 === 0x5B && b2 === 0x42) {
        index = (index + 1) % options.length
        renderMenu()
      }
    }

    const cleanup = () => {
      stdin.removeListener('data', onData)
      stdin.setRawMode?.(false)
      stdin.pause()
    }

    stdin.on('data', onData)
  })
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
    const sourceLabel = entry.answerSource === 'auto' ? 'auto' : 'user'
    grouped[entry.dimension]?.push(`${entry.question} -> ${entry.answer} [${sourceLabel}]`)
  }
  return grouped
}

function uniqueLines(lines: Array<string | undefined>): string[] {
  return Array.from(new Set(lines.filter((line): line is string => Boolean(line && line.trim()))))
}

function renderCapabilities(source: Record<string, string>, groupedAnswers: Record<string, string[]>): string {
  const items = uniqueLines([
    source.scope,
    source.userStory,
    groupedAnswers['scope']?.[0],
    groupedAnswers['user-story']?.[0],
  ])

  return [
    '## Capabilities',
    '',
    '### New',
    ...items.map((item) => `- ${item}`),
    '',
    '### Modified',
    ...uniqueLines([
      groupedAnswers['impact']?.[0],
      groupedAnswers['boundary']?.[0],
    ]).map((item) => `- ${item}`),
  ].join('\n')
}

function synthesizeProposalMarkdown(input: string, engine: YggPointEngine): string {
  const source = splitSourceText(input)
  const groupedAnswers = collectAnswersByDimension(engine)

  const whyLines = uniqueLines([source.motivation, ...(groupedAnswers['motivation'] ?? [])])
  const whatChangeLines = uniqueLines([source.scope, source.userStory, ...(groupedAnswers['scope'] ?? [])])
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

function truncateLabel(input: string, maxLength: number): string {
  return input.length <= maxLength
    ? input
    : `${input.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function formatEvaluatorLabel(evaluatorType: string): string {
  const labels: Record<string, string> = {
    base: '핵심 정의',
    humanistic: '사용자 관점',
    domain: '도메인 관점',
    reference: '참고 근거',
    consistency: '일관성',
  }
  return labels[evaluatorType] ?? evaluatorType
}

function countAnsweredRoundsByDimension(engine: YggPointEngine): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of engine.getHistory()) {
    counts[entry.dimension] = (counts[entry.dimension] ?? 0) + 1
  }
  return counts
}

function countManualAnsweredRoundsByDimension(engine: YggPointEngine): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of engine.getHistory()) {
    if (entry.answerSource === 'auto') continue
    counts[entry.dimension] = (counts[entry.dimension] ?? 0) + 1
  }
  return counts
}

function getDimensionsBelowMinimumManualQuestions(engine: YggPointEngine): string[] {
  const counts = countManualAnsweredRoundsByDimension(engine)
  return createStageDefinition.dimensions
    .map((dimension) => dimension.name)
    .filter((dimensionName) => (counts[dimensionName] ?? 0) < MIN_MANUAL_QUESTIONS_PER_DIMENSION)
}

function hasSatisfiedMinimumManualQuestions(engine: YggPointEngine): boolean {
  return getDimensionsBelowMinimumManualQuestions(engine).length === 0
}

function buildMinimumDepthQuestion(
  dimensionName: string,
  manualRound: number,
): YggPointQuestion {
  const dimension = createStageDefinition.dimensions.find((entry) => entry.name === dimensionName)
  const fallbackQuestion = `${dimensionName} 관점에서 이전 답변에서 빠진 구체 예시, 제약, 성공 기준을 보강해주세요.`
  const question = dimension
    ? `${dimension.baseQuestion} ${manualRound}회차 보강 답변으로 이전 답변에서 빠진 예시, 제약, 성공 기준을 추가해주세요.`
    : fallbackQuestion

  return {
    dimension: dimensionName,
    evaluatorType: 'base',
    question,
    priority: manualRound,
  }
}

function buildQuestionSelectionOptions(
  questions: readonly YggPointQuestion[],
  scoreMap: Readonly<Record<string, number>>,
): CreateSelectOption[] {
  return questions.map((question, index) => {
    const score = scoreMap[question.dimension]
    const header = `${index + 1}. ${question.dimension} · ${formatEvaluatorLabel(question.evaluatorType)}`
    const scoreLabel = typeof score === 'number' ? `현재 ${score.toFixed(2)}` : '현재 점수 없음'
    return {
      value: String(index),
      label: `${header} · ${scoreLabel} · ${truncateLabel(question.question, 72)}`,
    }
  })
}

function formatQuestionPrompt(
  question: YggPointQuestion,
  currentScore: number,
  dimensionRound: number,
  dimensionRoundLimit: number,
): string {
  const guidanceByEvaluator: Record<string, string[]> = {
    base: [
      '무엇을 바꾸는지 한 문장으로 먼저 고정하세요.',
      '이번 토픽에 포함할 것과 제외할 것을 같이 적으세요.',
      '결과물이 어떻게 달라져야 하는지 적으세요.',
    ],
    humanistic: [
      '가장 크게 불편한 사용자 순간을 적으세요.',
      '변경 후 사용자가 체감해야 할 차이를 적으세요.',
      '성공 기준이 있다면 같이 적으세요.',
    ],
    domain: [
      '현재 방식과 비교해 왜 이 방향이 맞는지 적으세요.',
      '기술적으로 어디까지 포함할지 경계를 적으세요.',
      '나중으로 미룰 항목이 있다면 같이 적으세요.',
    ],
    reference: [
      '참고할 문서, 기존 구현, 유사 사례가 있으면 적으세요.',
      '없다면 없다고 명시하고 근거 부족 리스크를 적으세요.',
    ],
    consistency: [
      '기존 명령/구조/흐름과 어떻게 맞출지 적으세요.',
      '충돌 가능성이 있는 기존 동작이 있으면 적으세요.',
    ],
  }
  const guidance = guidanceByEvaluator[question.evaluatorType] ?? guidanceByEvaluator.base ?? []

  return [
    `[${question.dimension} Round ${dimensionRound}/${dimensionRoundLimit}] ${formatEvaluatorLabel(question.evaluatorType)} · score ${currentScore.toFixed(2)}`,
    question.question,
    '',
    '답변 가이드:',
    ...guidance.map((line) => `- ${line}`),
    '',
    '답변: ',
  ].join('\n')
}

async function selectOption(
  prompt: string,
  options: readonly CreateSelectOption[],
  askQuestion: (question: string) => Promise<string | null>,
  customSelect?: (prompt: string, options: readonly CreateSelectOption[]) => Promise<string | null>,
): Promise<string | null> {
  if (customSelect) {
    return customSelect(prompt, options)
  }

  if (process.stdin.isTTY && process.stdout.isTTY) {
    process.stdout.write(`${prompt}\n`)
    return arrowKeySelect(options)
  }

  const menuText = [
    prompt,
    ...options.map((option, index) => `${index + 1}. ${option.label}`),
    '번호를 입력하세요: ',
  ].join('\n')
  const raw = await askQuestion(menuText)
  if (!raw) return null

  const numeric = Number.parseInt(raw, 10)
  if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= options.length) {
    return options[numeric - 1]?.value ?? null
  }

  const matched = options.find((option) => option.value === raw || option.label === raw)
  return matched?.value ?? null
}

async function askSelectedQuestion(
  engine: YggPointEngine,
  description: string,
  roundLimitByDimension: number,
  allowOverflow: boolean,
  enforceMinimumManualQuestions: boolean,
  askQuestion: (question: string) => Promise<string | null>,
  chooseOption: (prompt: string, options: readonly CreateSelectOption[]) => Promise<string | null>,
): Promise<boolean> {
  const evaluation = engine.evaluate(description)
  const scoreMap = Object.fromEntries(
    evaluation.breakdown.map((entry) => [entry.name, entry.score]),
  ) as Record<string, number>
  const answeredCounts = countAnsweredRoundsByDimension(engine)
  const manualCounts = countManualAnsweredRoundsByDimension(engine)
  const engineChoices = engine.getQuestionChoices(description, QUESTION_MENU_LIMIT * 3)
    .filter((question) => allowOverflow || (answeredCounts[question.dimension] ?? 0) < roundLimitByDimension)
  const choices = enforceMinimumManualQuestions
    ? createStageDefinition.dimensions
      .map((dimension) => dimension.name)
      .filter((dimensionName) => (manualCounts[dimensionName] ?? 0) < MIN_MANUAL_QUESTIONS_PER_DIMENSION)
      .map((dimensionName) => {
        const existing = engineChoices.find((question) => question.dimension === dimensionName)
        if (existing) {
          return existing
        }
        return buildMinimumDepthQuestion(dimensionName, (manualCounts[dimensionName] ?? 0) + 1)
      })
      .slice(0, QUESTION_MENU_LIMIT)
    : engineChoices.slice(0, QUESTION_MENU_LIMIT)
  if (choices.length === 0) {
    return false
  }

  const options = buildQuestionSelectionOptions(choices, scoreMap)
  const selectedValue = await chooseOption(
    enforceMinimumManualQuestions
      ? `auto-mode off 이므로 각 차원별 최소 5회 질문이 필요합니다. 질문을 고르세요. (1-${options.length} 또는 ↑↓ + Enter, q 취소)`
      : `차원별 기본 5회 기준으로 더 명확하게 만들 질문을 고르세요. (1-${options.length} 또는 ↑↓ + Enter, q 취소)`,
    options,
  )
  if (!selectedValue) {
    throw new Error('Create aborted during question selection')
  }

  const selectedIndex = Number.parseInt(selectedValue, 10)
  const selectedQuestion = options[selectedIndex] ? choices[selectedIndex] : undefined
  if (!selectedQuestion) {
    throw new Error(`Unknown question selection: ${selectedValue}`)
  }

  let answer: string | null = null
  const nextDimensionRound = (answeredCounts[selectedQuestion.dimension] ?? 0) + 1
  while (!answer) {
    answer = await askQuestion(
      formatQuestionPrompt(
        selectedQuestion,
        scoreMap[selectedQuestion.dimension] ?? evaluation.score,
        nextDimensionRound,
        roundLimitByDimension,
      ),
    )
    if (!answer) {
      logger.warn('Answer required to continue create-stage scoring.')
    }
  }

  engine.addAnswer(selectedQuestion, answer, 'user')
  return true
}

async function promptExtraRoundDecision(
  chooseOption: (prompt: string, options: readonly CreateSelectOption[]) => Promise<string | null>,
): Promise<'continue-1' | 'continue-3' | 'finalize' | 'cancel'> {
  const options: CreateSelectOption[] = [
    { value: 'continue-1', label: '1. 특정 차원 추가 질문 계속' },
    { value: 'continue-3', label: '2. 제한 없이 더 끌어올리기' },
    { value: 'finalize', label: '3. 현재 점수로 proposal 생성' },
    { value: 'cancel', label: '4. 취소' },
  ]

  const selected = await chooseOption(
    `기본 5회 한도에 도달한 차원이 있습니다. 추가 질답으로 해당 차원을 더 끌어올릴지 선택하세요. (1-${options.length} 또는 ↑↓ + Enter, q 취소)`,
    options,
  )

  if (selected === 'continue-1' || selected === 'continue-3' || selected === 'finalize' || selected === 'cancel') {
    return selected
  }

  logger.warn('Unknown selection, falling back to current score proposal generation.')
  return 'finalize'
}

export async function runCreate(
  projectRoot: string,
  options: CreateOptions = {},
  deps: CreateDependencies = {},
): Promise<void> {
  await ensureWorkspace(projectRoot)

  const askQuestion = deps.askQuestion ?? promptInput
  const chooseOption = (prompt: string, menuOptions: readonly CreateSelectOption[]) =>
    selectOption(prompt, menuOptions, askQuestion, deps.selectOption)
  let description = options.description?.trim()

  if (!description) {
    if (!process.stdin.isTTY) {
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

  const engine = new YggPointEngine(createStageDefinition)
  const autoMode = await readConfigYggPointAutoMode(projectRoot)

  let loopResult = engine.runQuestionLoop(description, { autoMode })
  logger.info(YggPointEngine.formatScore(loopResult.result, engine.getThreshold()))

  let roundLimitByDimension = DEFAULT_CREATE_ROUND_LIMIT
  let allowOverflow = false

  while (!loopResult.result.ready || (autoMode === 'off' && !hasSatisfiedMinimumManualQuestions(engine))) {
    const enforceMinimumManualQuestions = autoMode === 'off' && !hasSatisfiedMinimumManualQuestions(engine)
    const asked = await askSelectedQuestion(
      engine,
      description,
      roundLimitByDimension,
      allowOverflow,
      enforceMinimumManualQuestions,
      askQuestion,
      chooseOption,
    )

    if (!asked) {
      if (enforceMinimumManualQuestions) {
        throw new Error('Create could not continue the required minimum question loop')
      }
      const decision = await promptExtraRoundDecision(chooseOption)
      if (decision === 'continue-1') {
        roundLimitByDimension += 1
        continue
      }
      if (decision === 'continue-3') {
        allowOverflow = true
        continue
      }
      if (decision === 'cancel') {
        throw new Error('Create aborted by user')
      }
      break
    }
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
}
