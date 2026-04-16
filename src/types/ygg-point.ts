/** YGG Point 스코어링 엔진 타입 정의 */

/** 평가기 유형 */
export type EvaluatorType = 'humanistic' | 'domain' | 'reference' | 'consistency' | 'base'
export type YggPointAnswerSource = 'user' | 'auto'

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
  readonly displayName: string
  readonly weight: number
  readonly description: string
  readonly baseQuestion: string
  readonly completionHint: string
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
  readonly stage?: StageName
  readonly dimension: string
  readonly evaluatorType: string
  readonly questionId?: string
  readonly question: string
  readonly answer: string
  readonly timestamp: string
  readonly answerSource?: YggPointAnswerSource
  readonly scoreBefore?: number
  readonly scoreAfter?: number
  readonly dimensionScoreBefore?: number
  readonly dimensionScoreAfter?: number
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
  readonly id: string
  readonly dimension: string
  readonly dimensionDisplayName: string
  readonly evaluatorType: string
  readonly question: string
  readonly priority: number
}

export interface YggPointLoopOptions {
  readonly autoMode?: YggPointAutoMode | null
}

export interface YggPointLoopResult {
  readonly result: YggPointResult
  readonly autoAnswersAdded: number
}

/** YGG Point 설정 */
export interface YggPointConfig {
  readonly threshold: number
  readonly baseWeight: number
  readonly qualityWeight: number
  readonly maxQuestionsPerRound: number
}

export type YggPointAutoMode = 'on' | 'off'

/** 스테이지 이름 */
export type StageName = 'create' | 'next'

/** 스테이지 정의 */
export interface StageDefinition {
  readonly stage: StageName
  readonly dimensions: Dimension[]
  readonly config?: Partial<YggPointConfig>
}

export type YggPointArchiveType = 'breaking' | 'feat' | 'fix' | 'docs' | 'refactor' | 'chore'

export interface YggPointDimensionQuestionTrailEntry {
  readonly round: number
  readonly answerSource?: YggPointAnswerSource
  readonly evaluatorType: string
  readonly questionId?: string
  readonly question: string
  readonly answer: string
  readonly scoreBefore: number
  readonly scoreAfter: number
  readonly delta: number
  readonly timestamp?: string
}

export interface YggPointDimensionDetail {
  readonly displayName: string
  readonly description: string
  readonly initialScore: number
  readonly finalScore: number
  readonly delta: number
  readonly rationale: string
  readonly notes: string
  readonly questionTrail: readonly YggPointDimensionQuestionTrailEntry[]
}

export interface YggPointStageSnapshot {
  readonly ready: boolean
  readonly initialScore: number
  readonly finalScore: number
  readonly delta: number
  readonly rounds: number
  readonly questionsAnswered: number
  readonly improvementSummary: string
  readonly dimensions: Readonly<Record<string, YggPointDimensionDetail>>
}

export interface YggPointLegacyDimensionSummary {
  readonly score: number
  readonly note?: string
  readonly notes?: string
}

export interface YggPointDocument {
  readonly schemaVersion: '2.0'
  readonly topic?: string
  readonly date?: string
  readonly requestText?: string
  readonly archiveType?: YggPointArchiveType
  readonly currentStage: StageName
  readonly threshold: number
  readonly score: number
  readonly ready: boolean
  readonly stages: Partial<Record<StageName, YggPointStageSnapshot>>
  readonly history?: readonly QAEntry[]
}
