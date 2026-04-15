/** YGG Point 스코어링 엔진 타입 정의 */

/** 평가기 유형 */
export type EvaluatorType = 'humanistic' | 'domain' | 'reference' | 'consistency' | 'base'

/** 품질 평가기 */
export interface QualityEvaluator {
  readonly type: string
  readonly description: string
  readonly question: string
  readonly sources?: readonly string[]
  readonly autoVerifiable: boolean
}

/** 평가 차원 */
export interface Dimension {
  readonly name: string
  readonly weight: number
  readonly description: string
  readonly baseQuestion: string
  readonly evaluators: readonly QualityEvaluator[]
}

/** 차원별 점수 */
export interface DimensionScore {
  readonly name: string
  readonly baseFill: number
  readonly qualityScore: number
  readonly score: number
  readonly pendingQuestions: string[]
}

/** Q&A 이력 항목 */
export interface QAEntry {
  readonly dimension: string
  readonly evaluatorType: string
  readonly question: string
  readonly answer: string
  readonly timestamp: string
}

/** YGG Point 평가 결과 */
export interface YggPointResult {
  readonly score: number
  readonly breakdown: DimensionScore[]
  readonly nextQuestions: YggPointQuestion[]
  readonly ready: boolean
  readonly history: QAEntry[]
}

/** 다음 질문 */
export interface YggPointQuestion {
  readonly dimension: string
  readonly evaluatorType: string
  readonly question: string
  readonly priority: number
}

/** YGG Point 설정 */
export interface YggPointConfig {
  readonly threshold: number
  readonly baseWeight: number
  readonly qualityWeight: number
  readonly maxQuestionsPerRound: number
}

/** 스테이지 이름 */
export type StageName = 'create' | 'next'

/** 스테이지 정의 */
export interface StageDefinition {
  readonly stage: StageName
  readonly dimensions: Dimension[]
  readonly config?: Partial<YggPointConfig>
}
