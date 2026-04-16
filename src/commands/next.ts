import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as readline from 'node:readline'

import { readChangeIndex, writeChangeIndex } from '../core/change-index.js'
import { nextStageDefinition } from '../core/dimensions/next.js'
import { createYggPointDocument, YggPointEngine } from '../core/ygg-point.js'
import { readConfigYggPointAutoMode } from '../i18n/config.js'
import type { YggPointDocument, YggPointQuestion } from '../types/ygg-point.js'
import { logger } from '../utils/logger.js'

interface NextSelectOption {
  readonly value: string
  readonly label: string
}

export interface NextDependencies {
  askQuestion?: (question: string) => Promise<string | null>
  selectOption?: (prompt: string, options: readonly NextSelectOption[]) => Promise<string | null>
  now?: () => Date
}

const DEFAULT_NEXT_ROUND_LIMIT = 5
const MIN_MANUAL_QUESTIONS_PER_DIMENSION = 5
const QUESTION_MENU_LIMIT = 5

function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  options: readonly NextSelectOption[],
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

function truncateLabel(input: string, maxLength: number): string {
  return input.length <= maxLength
    ? input
    : `${input.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function formatEvaluatorLabel(evaluatorType: string): string {
  const labels: Record<string, string> = {
    base: '핵심 설계',
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
  return nextStageDefinition.dimensions
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
  const dimension = nextStageDefinition.dimensions.find((entry) => entry.name === dimensionName)
  const fallbackQuestion = `${dimensionName} 설계 관점에서 이전 답변에서 빠진 구조, 제약, 롤백 조건을 보강해주세요.`
  const question = dimension
    ? `${dimension.baseQuestion} ${manualRound}회차 보강 답변으로 이전 답변에서 빠진 구조, 제약, 롤백 조건을 추가해주세요.`
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
): NextSelectOption[] {
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

async function selectOption(
  prompt: string,
  options: readonly NextSelectOption[],
  askQuestion: (question: string) => Promise<string | null>,
  customSelect?: (prompt: string, options: readonly NextSelectOption[]) => Promise<string | null>,
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

function formatQuestionPrompt(
  question: YggPointQuestion,
  currentScore: number,
  dimensionRound: number,
  dimensionRoundLimit: number,
): string {
  const guidanceByEvaluator: Record<string, string[]> = {
    base: [
      '설계 결정 하나를 먼저 고정하세요.',
      '구현 순서, 영향 범위, 롤백 가능성을 함께 적으세요.',
      '이미 create에서 정한 범위를 넘기지 말고 설계만 명확히 하세요.',
    ],
    humanistic: [
      '처음 보는 개발자가 어떻게 이해할지를 기준으로 설명하세요.',
      '사용자나 운영자가 체감할 결과를 같이 적으세요.',
    ],
    domain: [
      '대안과 비교해 왜 이 방향이 맞는지 적으세요.',
      '도메인 규칙이나 패턴에 비춰 어떤 장단점이 있는지 적으세요.',
    ],
    reference: [
      '기존 파일/패턴/테스트와 맞물리는 구조를 적으세요.',
      '참고 기준이 없다면 그 리스크를 적으세요.',
    ],
    consistency: [
      '기존 구조와 충돌하지 않도록 어떤 원칙을 지킬지 적으세요.',
      '의존성, import, 파일 배치를 함께 적으세요.',
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

async function askSelectedQuestion(
  engine: YggPointEngine,
  input: string,
  roundLimitByDimension: number,
  allowOverflow: boolean,
  enforceMinimumManualQuestions: boolean,
  askQuestion: (question: string) => Promise<string | null>,
  chooseOption: (prompt: string, options: readonly NextSelectOption[]) => Promise<string | null>,
): Promise<boolean> {
  const evaluation = engine.evaluate(input)
  const scoreMap = Object.fromEntries(
    evaluation.breakdown.map((entry) => [entry.name, entry.score]),
  ) as Record<string, number>
  const answeredCounts = countAnsweredRoundsByDimension(engine)
  const manualCounts = countManualAnsweredRoundsByDimension(engine)
  const engineChoices = engine.getQuestionChoices(input, QUESTION_MENU_LIMIT * 3)
    .filter((question) => allowOverflow || (answeredCounts[question.dimension] ?? 0) < roundLimitByDimension)
  const choices = enforceMinimumManualQuestions
    ? nextStageDefinition.dimensions
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
      ? `auto-mode off 이므로 각 차원별 최소 5회 질문이 필요합니다. 차원을 선택하세요. (1-${options.length} 또는 ↑↓ + Enter, q 취소)`
      : `차원별 기본 5회 기준으로 더 끌어올릴 차원을 선택하세요. auto-verifiable 항목은 설정에 따라 내부 반영됩니다. (1-${options.length} 또는 ↑↓ + Enter, q 취소)`,
    options,
  )
  if (!selectedValue) {
    throw new Error('Next aborted during question selection')
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
      logger.warn('Answer required to continue next-stage scoring.')
    }
  }

  engine.addAnswer(selectedQuestion, answer, 'user')
  return true
}

async function promptExtraRoundDecision(
  chooseOption: (prompt: string, options: readonly NextSelectOption[]) => Promise<string | null>,
): Promise<'continue' | 'finalize' | 'cancel'> {
  const options: NextSelectOption[] = [
    { value: 'continue', label: '1. 특정 차원 추가 질문 계속' },
    { value: 'finalize', label: '2. 현재 점수로 next 문서 생성' },
    { value: 'cancel', label: '3. 취소' },
  ]

  const selected = await chooseOption(
    `기본 5회 한도에 도달한 차원이 있습니다. 다음 라운드에서 더 끌어올릴 차원을 다시 선택할 수 있습니다. (1-${options.length} 또는 ↑↓ + Enter, q 취소)`,
    options,
  )

  if (selected === 'continue' || selected === 'finalize' || selected === 'cancel') {
    return selected
  }

  return 'finalize'
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
  engine: YggPointEngine,
): string {
  const groupedAnswers = collectAnswersByDimension(engine)
  const proposalLines = compactMarkdownText(proposal)

  const contextLines = uniqueLines([
    requestText,
    proposalLines.find((line) => /^- /.test(line)),
    groupedAnswers['architecture']?.[0],
  ])

  const decisionSections = [
    ['Architecture', uniqueLines([groupedAnswers['architecture']?.[0], groupedAnswers['dependency']?.[0]])],
    ['Trade-off', uniqueLines([groupedAnswers['tradeoff']?.[0], groupedAnswers['constraint']?.[0]])],
    ['Rollback', uniqueLines([groupedAnswers['rollback']?.[0]])],
  ] as const

  return [
    `# Design: ${topic}`,
    '',
    '## Context',
    ...contextLines.map((line) => `- ${line}`),
    '',
    '## Goals / Non-Goals',
    ...uniqueLines([
      proposalLines.find((line) => /What Changes/i.test(line)),
      proposalLines.find((line) => /Boundary/i.test(line)),
      'Non-Goal: create 단계에서 정한 범위를 넘는 신규 요구 추가는 하지 않는다.',
    ]).map((line) => `- ${line}`),
    '',
    '## Decisions',
    ...decisionSections.flatMap(([title, lines]) => {
      if (lines.length === 0) return [`### ${title}`, '- 기존 proposal과 코드 구조를 기준으로 최소 변경 설계를 유지한다.', '']
      return [`### ${title}`, ...lines.map((line) => `- ${line}`), '']
    }),
    '## Constraints',
    ...uniqueLines([
      '기존 ygg-point 스키마와 Topic Detail viewer가 읽을 수 있는 형태를 유지한다.',
      groupedAnswers['constraint']?.[0],
    ]).map((line) => `- ${line}`),
    '',
    '## Risks / Trade-offs',
    ...uniqueLines([
      groupedAnswers['tradeoff']?.[0],
      '질문 라운드가 길어질수록 문서 밀도는 올라가지만 작성 시간이 늘어난다.',
    ]).map((line) => `- ${line}`),
    '',
    '## Migration Plan',
    '- 1. ygg-point 스키마와 stage trail 계약을 확정한다.',
    '- 2. create/next 명령과 관련 문서를 같은 계약으로 맞춘다.',
    '- 3. 대시보드와 테스트를 갱신한다.',
    '',
    '## Open Questions',
    '- 추가 구현 단계에서 분리해야 할 spec 경계가 있는지 검토한다.',
    '',
  ].join('\n')
}

function synthesizeSpecMarkdown(
  topic: string,
  requestText: string,
  engine: YggPointEngine,
): string {
  const groupedAnswers = collectAnswersByDimension(engine)

  return [
    `# Spec: ${topic}`,
    '',
    '## Requirements',
    '- [ ] next 단계는 create 토픽을 읽어 design.md, specs/, tasks.md를 생성해야 한다.',
    '- [ ] next 단계의 YGG Point는 사용자 선택 질문과 auto-verifiable 내부 반영을 모두 지원해야 한다.',
    '- [ ] ygg-point.json은 top-level requestText와 차원별 questionTrail만으로 점수 상승을 설명해야 한다.',
    '- [ ] questionTrail.round는 각 차원 안에서 질문에 따라 점수가 어떻게 단계적으로 올라갔는지 추적 가능해야 한다.',
    '- [ ] auto-verifiable 응답은 answerSource=auto로 구분되어야 한다.',
    '',
    '## Constraints',
    ...uniqueLines([
      requestText,
      groupedAnswers['constraint']?.[0],
      '중복된 top-level history 블록이나 사용되지 않는 요약 필드는 새로 만들지 않는다.',
    ]).map((line) => `- ${line}`),
    '',
    '## Interface',
    '- Input: proposal.md + 기존 ygg-point.json + 사용자 질답',
    '- Output: design.md + specs/spec-core/spec.md + tasks.md + 갱신된 ygg-point.json',
    '',
  ].join('\n')
}

function synthesizeTasksMarkdown(): string {
  return [
    '# Tasks',
    '',
    '1. core ygg-point 스키마와 questionTrail 라운드 계약을 정리한다.',
    '- [ ] requestText, answerSource, 차원별 questionTrail.round semantics 반영',
    '',
    '2. create/next 명령의 질문 루프와 문서 생성 흐름을 맞춘다.',
    '- [ ] create에 requestText와 lean schema 반영',
    '- [ ] next 명령 추가 및 index/ygg-point 갱신 연결',
    '',
    '3. dashboard와 문서를 새 계약에 맞춘다.',
    '- [ ] Topic Detail viewer 갱신',
    '- [ ] skill/docs/scripts 문구 정리',
    '',
    '4. verification',
    '- [ ] 관련 unit test와 타입체크 실행',
    '',
  ].join('\n')
}

async function findActiveCreateTopic(projectRoot: string): Promise<{ topic: string; description: string } | null> {
  const index = await readChangeIndex(projectRoot)
  const candidates = index.topics
    .filter((entry) => entry.stage === 'create')
    .sort((a, b) => b.date.localeCompare(a.date) || a.topic.localeCompare(b.topic))

  const selected = candidates[0]
  if (!selected) {
    return null
  }
  return { topic: selected.topic, description: selected.description }
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
  const askQuestion = deps.askQuestion ?? promptInput
  const chooseOption = (prompt: string, menuOptions: readonly NextSelectOption[]) =>
    selectOption(prompt, menuOptions, askQuestion, deps.selectOption)

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

  const engine = new YggPointEngine(nextStageDefinition)
  const autoMode = await readConfigYggPointAutoMode(projectRoot)
  let loopResult = engine.runQuestionLoop(stageInput, { autoMode })
  logger.info(YggPointEngine.formatScore(loopResult.result, engine.getThreshold()))

  let roundLimitByDimension = DEFAULT_NEXT_ROUND_LIMIT
  const allowOverflow = false

  while (!loopResult.result.ready || (autoMode === 'off' && !hasSatisfiedMinimumManualQuestions(engine))) {
    const enforceMinimumManualQuestions = autoMode === 'off' && !hasSatisfiedMinimumManualQuestions(engine)
    const asked = await askSelectedQuestion(
      engine,
      stageInput,
      roundLimitByDimension,
      allowOverflow,
      enforceMinimumManualQuestions,
      askQuestion,
      chooseOption,
    )

    if (!asked) {
      if (enforceMinimumManualQuestions) {
        throw new Error('Next could not continue the required minimum question loop')
      }
      const decision = await promptExtraRoundDecision(chooseOption)
      if (decision === 'continue') {
        roundLimitByDimension += 1
        continue
      }
      if (decision === 'cancel') {
        throw new Error('Next aborted by user')
      }
      break
    }
    loopResult = engine.runQuestionLoop(stageInput, { autoMode })
    logger.info(YggPointEngine.formatScore(loopResult.result, engine.getThreshold()))
  }

  const now = deps.now?.() ?? new Date()
  const date = formatDate(now)
  const specDir = join(topicDir, 'specs', 'spec-core')
  await mkdir(specDir, { recursive: true })

  const design = synthesizeDesignMarkdown(activeTopic.topic, requestText, proposal, engine)
  const spec = synthesizeSpecMarkdown(activeTopic.topic, requestText, engine)
  const tasks = synthesizeTasksMarkdown()
  const yggPointDocument = createYggPointDocument({
    topic: activeTopic.topic,
    date,
    requestText,
    currentStage: 'next',
    archiveType: existingYggPoint?.archiveType ?? 'feat',
    stageDef: nextStageDefinition,
    userInput: stageInput,
    history: engine.getHistory(),
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
}
