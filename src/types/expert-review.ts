/** 전문가 조언/평가 모드 타입 정의 */

/** 전문가 역할 타입 */
export type ExpertRole = 'architect' | 'uiux' | 'data' | 'security' | 'performance';

/** 이슈 심각도 */
export type IssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

/** 전문가 정의 */
export interface ExpertDefinition {
  readonly role: ExpertRole;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly evaluationCriteria: readonly string[];
  /** 설계 문서에서 이 전문가를 선별하는 키워드 */
  readonly selectionKeywords: readonly string[];
  /** 채점 기준 (점수 범위별 기준) */
  readonly scoringRubric: ScoringRubric;
}

/** 채점 기준 */
export interface ScoringRubric {
  readonly ranges: readonly ScoreRange[];
}

/** 점수 범위별 기준 */
export interface ScoreRange {
  readonly min: number;
  readonly max: number;
  readonly description: string;
}

/** 전문가 개별 평가 결과 */
export interface ExpertEvaluation {
  readonly role: ExpertRole;
  readonly score: number;
  readonly strengths: readonly string[];
  readonly issues: readonly ReviewIssue[];
  readonly summary: string;
}

/** 리뷰 이슈 */
export interface ReviewIssue {
  readonly severity: IssueSeverity;
  readonly description: string;
  readonly recommendation: string;
}

/** 라운드별 점수 기록 */
export interface RoundScore {
  readonly role: ExpertRole;
  readonly score: number;
}

/** 리뷰 라운드 결과 */
export interface ReviewRound {
  readonly roundNumber: number;
  readonly selectedExperts: readonly ExpertRole[];
  readonly evaluations: readonly ExpertEvaluation[];
  readonly scores: readonly RoundScore[];
  readonly discussionSummary: string;
  readonly passed: boolean;
}

/** 리뷰 전체 결과 */
export interface ReviewResult {
  readonly topic: string;
  readonly rounds: readonly ReviewRound[];
  readonly finalVerdict: 'PASS' | 'RETRY' | 'OVERRIDE';
  readonly selectedExperts: readonly ExpertRole[];
}

/** 전문가 선별 결과 */
export interface ExpertSelectionResult {
  readonly selected: readonly ExpertRole[];
  readonly reasons: ReadonlyMap<ExpertRole, string>;
  readonly excluded: readonly ExpertRole[];
}

/** 리뷰 엔진 설정 */
export interface ReviewEngineConfig {
  /** 합격 임계값 (기본 0.95) */
  readonly threshold: number;
  /** 최대 라운드 수 (기본 5) */
  readonly maxRounds: number;
  /** 전문가 최소 인원 (기본 2) */
  readonly minExperts: number;
  /** 전문가 최대 인원 (기본 5) */
  readonly maxExperts: number;
  /** 전문가 모델 (기본 'sonnet') */
  readonly expertModel: string;
}

/** 기본 리뷰 엔진 설정 */
export const DEFAULT_REVIEW_CONFIG: ReviewEngineConfig = {
  threshold: 0.95,
  maxRounds: 5,
  minExperts: 2,
  maxExperts: 5,
  expertModel: 'sonnet',
} as const;
