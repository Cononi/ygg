/** YGG Point Engine — spec 완성도 스코어링 엔진 */

import type {
  Dimension,
  DimensionScore,
  QAEntry,
  QualityEvaluator,
  StageDefinition,
  YggPointConfig,
  YggPointQuestion,
  YggPointResult,
} from '../types/ygg-point.js'

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
        priority: (1 - dim.weight) * 10,
      })
    }

    // 미응답 평가기의 질문들 (baseFill과 무관하게 항상 후보에 포함)
    for (const ev of dim.evaluators) {
      const key = makEvaluatorKey(dim.name, ev)
      if (answeredSet.has(key)) continue

      // 우선순위: weight 높은 차원 + 사용자 답변 필수(autoVerifiable=false)가 먼저
      const autoBonus = ev.autoVerifiable ? 5 : 0
      const priority = (1 - dim.weight) * 10 + autoBonus

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
  addAnswer(question: YggPointQuestion, answer: string): void {
    this.history.push({
      dimension: question.dimension,
      evaluatorType: question.evaluatorType,
      question: question.question,
      answer,
      timestamp: new Date().toISOString(),
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
