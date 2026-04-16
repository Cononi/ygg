/** YGG Point Engine — spec 완성도 스코어링 엔진 */

import type {
  Dimension,
  DimensionScore,
  QAEntry,
  QualityEvaluator,
  StageDefinition,
  StageName,
  YggPointAnswerSource,
  YggPointArchiveType,
  YggPointAutoMode,
  YggPointConfig,
  YggPointDocument,
  YggPointDimensionDetail,
  YggPointDimensionQuestionTrailEntry,
  YggPointLoopOptions,
  YggPointLoopResult,
  YggPointQuestion,
  YggPointResult,
  YggPointStageSnapshot,
} from '../types/ygg-point.js'

export const DEFAULT_YGG_POINT_AUTO_MODE: YggPointAutoMode = 'off'

const DEFAULT_CONFIG: YggPointConfig = {
  threshold: 0.95,
  baseWeight: 0.3,
  qualityWeight: 0.7,
  maxQuestionsPerRound: 3,
}

/** Scoring constants */
const KEYWORD_RATIO_WEIGHT = 0.6
const LENGTH_FACTOR_WEIGHT = 0.4
const MIN_LINES_FOR_FULL_LENGTH = 5
const MIN_KEYWORD_MATCHES_FOR_FLOOR = 2
const MIN_KEYWORD_FLOOR = 0.4
const AUTO_VERIFY_PARTIAL_SCORE = 0.5
const LOW_BASEFILL_THRESHOLD = 0.3
const SUFFICIENT_BASEFILL_THRESHOLD = 0.5
const BASE_ANSWER_MIN_FILL = 0.7
const QUALITY_ANSWER_BOOST_MAX = 0.6
const DIMENSION_READY_THRESHOLD = 0.95
const BASEFILL_OK_THRESHOLD = 0.8

/** 텍스트에서 특정 차원의 baseFill을 분석한다 */
function analyzeBaseFill(text: string, dimension: Dimension): number {
  const lower = text.toLowerCase()
  const lines = text.split('\n').filter((l) => l.trim().length > 0)

  // 빈 입력
  if (lines.length === 0) return 0

  const keywordSets: Record<string, string[]> = {
    // create stage dimensions
    motivation: ['왜', '이유', '문제', '필요', 'why', 'because', 'reason', 'problem', '동기', '배경'],
    scope: ['범위', '대상', '어디', 'scope', 'target', '포함', '제외', '한정'],
    'user-story': ['사용자', '유저', 'user', '시나리오', '경험', 'ux', '화면', '흐름', 'flow'],
    boundary: ['제외', '하지 않', '범위 밖', 'non-goal', 'out of scope', '제한', '빼고', '않을'],
    impact: ['영향', '파일', '모듈', '의존', 'impact', 'affect', 'dependency', '변경', '수정'],
    // next stage dimensions
    architecture: ['아키텍처', '패턴', '구조', 'architecture', 'pattern', 'strategy', 'builder', '계층', '모듈', '인터페이스'],
    tradeoff: ['트레이드오프', '장단점', '대안', 'tradeoff', 'trade-off', '우선', '단순', '복잡', '성능', 'vs'],
    constraint: ['제약', '제한', '조건', 'constraint', 'strict', 'lint', '보안', '호환', '성능', '규칙'],
    dependency: ['의존', '순서', '먼저', '이후', 'dependency', 'order', 'import', '모듈', '단계'],
    rollback: ['롤백', '되돌', '복구', 'rollback', 'revert', '삭제', '실패', '원복', '안전'],
  }

  const keywords = keywordSets[dimension.name] ?? []
  if (keywords.length === 0) {
    // 키워드 세트가 없으면 텍스트 길이 기반 휴리스틱
    return Math.min(lines.length / 10, 1)
  }

  const matchCount = keywords.filter((kw) => lower.includes(kw)).length
  const ratio = matchCount / keywords.length

  // 매칭 비율 + 텍스트 충분성 결합 (비율 기반 가중치 강화)
  const lengthFactor = Math.min(lines.length / MIN_LINES_FOR_FULL_LENGTH, 1)
  const rawScore = ratio * KEYWORD_RATIO_WEIGHT + lengthFactor * LENGTH_FACTOR_WEIGHT

  const minFloor = matchCount >= MIN_KEYWORD_MATCHES_FOR_FLOOR ? MIN_KEYWORD_FLOOR : 0
  return Math.min(Math.max(rawScore, minFloor), 1)
}

/** 차원별 점수를 계산한다 */
function scoreDimension(
  dimension: Dimension,
  baseFill: number,
  answeredEvaluators: Set<string>,
  config: YggPointConfig,
): DimensionScore {
  const evaluators = dimension.evaluators
  const pendingQuestions: string[] = []

  let qualityTotal = 0
  const qualityCount = evaluators.length

  if (qualityCount === 0) {
    // 평가기가 없으면 baseFill만으로 판단
    return {
      name: dimension.name,
      baseFill,
      qualityScore: baseFill,
      score: baseFill,
      pendingQuestions: baseFill < BASEFILL_OK_THRESHOLD ? [dimension.baseQuestion] : [],
    }
  }

  for (const ev of evaluators) {
    const key = makEvaluatorKey(dimension.name, ev)
    if (answeredEvaluators.has(key)) {
      qualityTotal += 1
    } else if (ev.autoVerifiable) {
      // 자동 검증 가능한 항목은 baseFill에 비례해서 부분 점수
      qualityTotal += baseFill * AUTO_VERIFY_PARTIAL_SCORE
      if (baseFill < BASEFILL_OK_THRESHOLD) {
        pendingQuestions.push(ev.question)
      }
    } else {
      pendingQuestions.push(ev.question)
    }
  }

  const qualityScore = qualityTotal / qualityCount
  const score = config.baseWeight * baseFill + config.qualityWeight * qualityScore

  // baseFill 자체가 낮으면 기본 질문도 추가
  if (baseFill < SUFFICIENT_BASEFILL_THRESHOLD && pendingQuestions.length === 0) {
    pendingQuestions.unshift(dimension.baseQuestion)
  }

  return {
    name: dimension.name,
    baseFill,
    qualityScore,
    score,
    pendingQuestions,
  }
}

/** 평가기 고유 키 생성 */
function makEvaluatorKey(dimensionName: string, evaluator: QualityEvaluator): string {
  return `${dimensionName}:${evaluator.type}:${evaluator.description}`
}

function extractAnsweredEvaluatorDescriptions(dimension: Dimension, history: QAEntry[]): string[] {
  const descriptions: string[] = []
  for (const entry of history) {
    if (entry.dimension !== dimension.name || entry.evaluatorType === 'base') continue
    const evaluator = dimension.evaluators.find((ev) => ev.type === entry.evaluatorType)
    if (evaluator && !descriptions.includes(evaluator.description)) {
      descriptions.push(evaluator.description)
    }
  }
  return descriptions
}

function getDimensionScore(result: YggPointResult, dimensionName: string): number {
  return result.breakdown.find((item) => item.name === dimensionName)?.score ?? 0
}

function formatDimensionRationale(
  score: DimensionScore,
  answeredDescriptions: string[],
): string {
  const answeredLabel = answeredDescriptions.length > 0
    ? `반영된 평가: ${answeredDescriptions.join(', ')}.`
    : '반영된 평가 답변 없음.'
  const pendingLabel = score.pendingQuestions.length > 0
    ? `남은 질문 ${score.pendingQuestions.length}개.`
    : '남은 질문 없음.'
  return `기본 충실도 ${score.baseFill.toFixed(2)}, 품질 점수 ${score.qualityScore.toFixed(2)}. ${answeredLabel} ${pendingLabel}`
}

function formatImprovementSummary(initialScore: number, finalScore: number, questionsAnswered: number): string {
  const delta = finalScore - initialScore
  if (questionsAnswered === 0) {
    return `질문 없이 ${finalScore.toFixed(2)}로 평가됨`
  }
  return `${questionsAnswered}개 질문 응답으로 ${initialScore.toFixed(2)} → ${finalScore.toFixed(2)} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`
}

function formatDimensionNotes(
  questionTrail: readonly YggPointDimensionQuestionTrailEntry[],
  pendingQuestions: readonly string[],
  answeredDescriptions: readonly string[],
): string {
  const lastEntry = questionTrail[questionTrail.length - 1]
  if (lastEntry?.question && lastEntry.answer) {
    return `최종 반영 질답: ${lastEntry.question} / ${lastEntry.answer}`
  }
  if (pendingQuestions.length > 0) {
    return `추가 확인 필요: ${pendingQuestions[0]}`
  }
  if (answeredDescriptions.length > 0) {
    return `반영된 평가: ${answeredDescriptions.join(', ')}`
  }
  return '질문 없이 초기 입력 기준으로 평가됨'
}

function buildStageTimeline(
  stageDef: StageDefinition,
  userInput: string,
  history: QAEntry[],
): {
  initial: YggPointResult
  final: YggPointResult
  questionTrails: Record<string, YggPointDimensionQuestionTrailEntry[]>
} {
  const engine = new YggPointEngine(stageDef, [])
  const initial = engine.evaluate(userInput)
  const questionTrails = Object.fromEntries(
    stageDef.dimensions.map((dimension) => [dimension.name, [] as YggPointDimensionQuestionTrailEntry[]]),
  ) as Record<string, YggPointDimensionQuestionTrailEntry[]>
  const dimensionRoundCounts = Object.fromEntries(
    stageDef.dimensions.map((dimension) => [dimension.name, 0]),
  ) as Record<string, number>

  let final = initial
  history.forEach((entry) => {
    const previous = final
    engine.addAnswer({
      dimension: entry.dimension,
      evaluatorType: entry.evaluatorType,
      question: entry.question,
      priority: 0,
    }, entry.answer)
    final = engine.evaluate(userInput)

    const scoreBefore = getDimensionScore(previous, entry.dimension)
    const scoreAfter = getDimensionScore(final, entry.dimension)
    const trail = questionTrails[entry.dimension]
    if (trail) {
      dimensionRoundCounts[entry.dimension] = (dimensionRoundCounts[entry.dimension] ?? 0) + 1
      trail.push({
        round: dimensionRoundCounts[entry.dimension],
        answerSource: entry.answerSource,
        evaluatorType: entry.evaluatorType,
        question: entry.question,
        answer: entry.answer,
        scoreBefore,
        scoreAfter,
        delta: scoreAfter - scoreBefore,
        timestamp: entry.timestamp,
      })
    }
  })

  return { initial, final, questionTrails }
}

function buildStageSnapshot(
  stageDef: StageDefinition,
  userInput: string,
  history: QAEntry[],
): YggPointStageSnapshot {
  const { initial, final, questionTrails } = buildStageTimeline(stageDef, userInput, history)
  const dimensionEntries: Array<[string, YggPointDimensionDetail]> = stageDef.dimensions.map((dimension) => {
    const initialScore = initial.breakdown.find((item) => item.name === dimension.name)
    const finalScore = final.breakdown.find((item) => item.name === dimension.name)
    const answeredDescriptions = extractAnsweredEvaluatorDescriptions(dimension, history)
    const finalDimension = finalScore ?? {
      name: dimension.name,
      baseFill: 0,
      qualityScore: 0,
      score: 0,
      pendingQuestions: [],
    }
    const questionTrail = questionTrails[dimension.name] ?? []

    return [dimension.name, {
      description: dimension.description,
      initialScore: initialScore?.score ?? 0,
      finalScore: finalDimension.score,
      delta: finalDimension.score - (initialScore?.score ?? 0),
      rationale: formatDimensionRationale(finalDimension, answeredDescriptions),
      notes: formatDimensionNotes(questionTrail, finalDimension.pendingQuestions, answeredDescriptions),
      questionTrail,
    }]
  })

  const dimensions = Object.fromEntries(dimensionEntries) as Record<string, YggPointDimensionDetail>
  const questionsAnswered = history.length
  return {
    ready: final.ready,
    initialScore: initial.score,
    finalScore: final.score,
    delta: final.score - initial.score,
    rounds: history.length + 1,
    questionsAnswered,
    improvementSummary: formatImprovementSummary(initial.score, final.score, questionsAnswered),
    dimensions,
  }
}

export function createYggPointDocument(options: {
  topic?: string
  date?: string
  requestText?: string
  archiveType?: YggPointArchiveType
  currentStage: StageName
  stageDef: StageDefinition
  userInput: string
  history?: QAEntry[]
  existingDocument?: YggPointDocument
}): YggPointDocument {
  const snapshot = buildStageSnapshot(options.stageDef, options.userInput, options.history ?? [])
  const threshold = new YggPointEngine(options.stageDef).getThreshold()
  const stages: Partial<Record<StageName, YggPointStageSnapshot>> = {
    ...(options.existingDocument?.stages ?? {}),
    [options.stageDef.stage]: snapshot,
  }

  return {
    schemaVersion: '2.0',
    topic: options.topic ?? options.existingDocument?.topic,
    date: options.date ?? options.existingDocument?.date,
    requestText: options.requestText ?? options.existingDocument?.requestText,
    archiveType: options.archiveType ?? options.existingDocument?.archiveType,
    currentStage: options.currentStage,
    threshold,
    score: snapshot.finalScore,
    ready: snapshot.ready,
    stages,
  }
}

/** Q&A 이력에서 응답 완료된 평가기 키를 추출한다 */
function buildAnsweredSet(history: QAEntry[], dimensions: Dimension[]): Set<string> {
  const answered = new Set<string>()

  for (const entry of history) {
    const dim = dimensions.find((d) => d.name === entry.dimension)
    if (!dim) continue

    if (entry.evaluatorType === 'base') {
      // 기본 질문 응답 → 해당 차원의 baseFill 보정용 (별도 처리)
      continue
    }

    const ev = dim.evaluators.find((e) => e.type === entry.evaluatorType)
    if (ev) {
      answered.add(makEvaluatorKey(dim.name, ev))
    }
  }

  return answered
}

/** 우선순위 기반으로 다음 질문을 선정한다 */
function selectNextQuestions(
  breakdown: DimensionScore[],
  dimensions: Dimension[],
  answeredSet: Set<string>,
  maxCount: number,
): YggPointQuestion[] {
  const candidates: YggPointQuestion[] = []
  const evaluatorPriority: Record<string, number> = {
    base: 0,
    humanistic: 1,
    domain: 2,
    reference: 3,
    consistency: 4,
  }

  for (const ds of breakdown) {
    if (ds.score >= DIMENSION_READY_THRESHOLD) continue

    const dim = dimensions.find((d) => d.name === ds.name)
    if (!dim) continue

    // baseFill이 매우 낮으면 기본 질문을 높은 우선순위로 추가
    if (ds.baseFill < LOW_BASEFILL_THRESHOLD) {
      candidates.push({
        dimension: dim.name,
        evaluatorType: 'base',
        question: dim.baseQuestion,
        priority: ds.score * 100 + (1 - dim.weight) * 10,
      })
    }

    // 미응답 평가기의 질문들 (baseFill과 무관하게 항상 후보에 포함)
    for (const ev of dim.evaluators) {
      const key = makEvaluatorKey(dim.name, ev)
      if (answeredSet.has(key)) continue

      // 우선순위: weight 높은 차원 + 사용자 답변 필수(autoVerifiable=false)가 먼저
      const autoBonus = ev.autoVerifiable ? 5 : 0
      const evaluatorBonus = evaluatorPriority[ev.type] ?? 5
      const priority = ds.score * 100 + (1 - dim.weight) * 10 + autoBonus + evaluatorBonus

      candidates.push({
        dimension: dim.name,
        evaluatorType: ev.type,
        question: ev.question,
        priority,
      })
    }
  }

  candidates.sort((a, b) => a.priority - b.priority)
  return candidates.slice(0, maxCount)
}

function findEvaluator(
  dimensions: readonly Dimension[],
  question: YggPointQuestion,
): QualityEvaluator | undefined {
  const dimension = dimensions.find((entry) => entry.name === question.dimension)
  if (!dimension || question.evaluatorType === 'base') {
    return undefined
  }
  return dimension.evaluators.find((entry) => entry.type === question.evaluatorType)
}

function buildAutoAnswer(question: YggPointQuestion, evaluator?: QualityEvaluator): string {
  const sources = evaluator?.sources?.length
    ? evaluator.sources.join(', ')
    : 'project context'
  return `Auto-verified from ${sources} for ${question.dimension}:${question.evaluatorType}.`
}

/** 사용자 답변으로 baseFill을 보정한다 */
function adjustBaseFill(
  originalFill: number,
  dimension: Dimension,
  history: QAEntry[],
): number {
  const dimAnswers = history.filter((e) => e.dimension === dimension.name)

  if (dimAnswers.length === 0) return originalFill

  const hasBaseAnswer = dimAnswers.some((e) => e.evaluatorType === 'base')
  const qualityAnswerCount = dimAnswers.filter((e) => e.evaluatorType !== 'base').length
  const totalEvaluators = dimension.evaluators.length

  // 기본 질문에 답변 → baseFill 최소 0.7
  let adjusted = originalFill
  if (hasBaseAnswer) {
    adjusted = Math.max(adjusted, BASE_ANSWER_MIN_FILL)
  }

  if (qualityAnswerCount > 0 && totalEvaluators > 0) {
    const completionRatio = qualityAnswerCount / totalEvaluators
    const boost = completionRatio * QUALITY_ANSWER_BOOST_MAX
    adjusted = Math.max(adjusted, originalFill + boost)
  }

  return Math.min(adjusted, 1)
}

/** YGG Point 엔진 클래스 */
export class YggPointEngine {
  private readonly dimensions: Dimension[]
  private readonly config: YggPointConfig
  private history: QAEntry[]

  constructor(stageDef: StageDefinition, history: QAEntry[] = []) {
    this.dimensions = stageDef.dimensions
    this.config = { ...DEFAULT_CONFIG, ...stageDef.config }
    this.history = [...history]

    // weight 합계 검증
    const totalWeight = this.dimensions.reduce((sum, d) => sum + d.weight, 0)
    if (Math.abs(totalWeight - 1) > 0.01) {
      throw new Error(
        `Dimension weights must sum to 1.0, got ${totalWeight.toFixed(2)}`,
      )
    }
  }

  /** 사용자 입력 텍스트를 기반으로 평가를 수행한다 */
  evaluate(userInput: string): YggPointResult {
    const answeredSet = buildAnsweredSet(this.history, this.dimensions)
    const breakdown: DimensionScore[] = []

    for (const dim of this.dimensions) {
      const rawBaseFill = analyzeBaseFill(userInput, dim)
      const baseFill = adjustBaseFill(rawBaseFill, dim, this.history)
      const ds = scoreDimension(dim, baseFill, answeredSet, this.config)
      breakdown.push(ds)
    }

    const score = breakdown.reduce((sum, ds) => {
      const dim = this.dimensions.find((d) => d.name === ds.name)
      return sum + ds.score * (dim?.weight ?? 0)
    }, 0)

    const nextQuestions = selectNextQuestions(
      breakdown,
      this.dimensions,
      answeredSet,
      this.config.maxQuestionsPerRound,
    )

    return {
      score,
      breakdown,
      nextQuestions,
      ready: score >= this.config.threshold,
      history: this.history,
    }
  }

  /** 사용자 답변을 기록한다 */
  addAnswer(question: YggPointQuestion, answer: string, answerSource: YggPointAnswerSource = 'user'): void {
    this.history.push({
      dimension: question.dimension,
      evaluatorType: question.evaluatorType,
      question: question.question,
      answer,
      timestamp: new Date().toISOString(),
      answerSource,
    })
  }

  /** 현재 Q&A 이력을 반환한다 */
  getHistory(): QAEntry[] {
    return [...this.history]
  }

  /** threshold를 반환한다 */
  getThreshold(): number {
    return this.config.threshold
  }

  /** 설정을 반환한다 */
  getConfig(): YggPointConfig {
    return { ...this.config }
  }

  /** 현재 상태에서 우선순위가 높은 질문 후보를 limit 개까지 반환한다 */
  getQuestionChoices(userInput: string, limit: number = this.config.maxQuestionsPerRound): YggPointQuestion[] {
    const result = this.evaluate(userInput)
    return selectNextQuestions(
      result.breakdown,
      this.dimensions,
      buildAnsweredSet(this.history, this.dimensions),
      limit,
    )
  }

  /**
   * auto-mode가 on이면 auto-verifiable 질문을 내부 답변으로 모두 처리한 뒤 결과를 반환한다.
   * off이면 현재 상태 평가만 반환한다.
   */
  runQuestionLoop(userInput: string, options: YggPointLoopOptions = {}): YggPointLoopResult {
    const autoMode = resolveYggPointAutoMode(options.autoMode)
    let result = this.evaluate(userInput)
    let autoAnswersAdded = 0

    while (autoMode === 'on' && !result.ready) {
      const autoQuestions = selectNextQuestions(
        result.breakdown,
        this.dimensions,
        buildAnsweredSet(this.history, this.dimensions),
        Number.MAX_SAFE_INTEGER,
      ).filter((question) => {
        const evaluator = findEvaluator(this.dimensions, question)
        return evaluator?.autoVerifiable === true
      })

      if (autoQuestions.length === 0) {
        break
      }

      for (const question of autoQuestions) {
        const evaluator = findEvaluator(this.dimensions, question)
        this.addAnswer(question, buildAutoAnswer(question, evaluator), 'auto')
        autoAnswersAdded += 1
      }

      result = this.evaluate(userInput)
    }

    if (autoMode === 'on' && result.nextQuestions.length > 0) {
      result = {
        ...result,
        nextQuestions: result.nextQuestions.filter((question) => {
          return question.evaluatorType !== 'reference' && question.evaluatorType !== 'consistency'
        }),
      }
    }

    return {
      result,
      autoAnswersAdded,
    }
  }

  /** 점수를 사람이 읽기 좋은 문자열로 포매팅한다 */
  static formatScore(result: YggPointResult, threshold: number): string {
    const bar = (score: number): string => {
      const filled = Math.round(score * 5)
      return '\u2588'.repeat(filled) + '\u2591'.repeat(5 - filled)
    }

    const lines: string[] = [
      `[YGG Point: ${result.score.toFixed(2)}] ${result.ready ? '\u2705 Ready' : `\u274C < ${threshold}`}`,
    ]

    for (const ds of result.breakdown) {
      lines.push(` \u251C\u2500 ${ds.name}: ${bar(ds.score)} ${ds.score.toFixed(2)}`)
      lines.push(`   \u2502  baseFill: ${ds.baseFill.toFixed(2)} | quality: ${ds.qualityScore.toFixed(2)}`)
    }

    return lines.join('\n')
  }
}

export function resolveYggPointAutoMode(autoMode?: YggPointAutoMode | null): YggPointAutoMode {
  return autoMode === 'on' ? 'on' : DEFAULT_YGG_POINT_AUTO_MODE
}

export function isYggPointAutoModeEnabled(autoMode?: YggPointAutoMode | null): boolean {
  return resolveYggPointAutoMode(autoMode) === 'on'
}
