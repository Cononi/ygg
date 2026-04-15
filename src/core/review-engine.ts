/** 리뷰 엔진 — 반복 정제 루프 관리 */

import type {
  ExpertRole,
  ExpertEvaluation,
  ReviewRound,
  ReviewResult,
  ReviewEngineConfig,
  RoundScore,
} from '../types/expert-review.js';
import { DEFAULT_REVIEW_CONFIG } from '../types/expert-review.js';

/** 리뷰 엔진: 전문가 평가의 반복 정제 루프를 관리한다 */
export class ReviewEngine {
  private readonly config: ReviewEngineConfig;
  private readonly rounds: ReviewRound[] = [];
  private readonly selectedExperts: readonly ExpertRole[];

  constructor(
    selectedExperts: readonly ExpertRole[],
    config?: Partial<ReviewEngineConfig>,
  ) {
    this.config = { ...DEFAULT_REVIEW_CONFIG, ...config };
    this.selectedExperts = selectedExperts;
  }

  /** 현재 라운드 번호를 반환한다 */
  getCurrentRound(): number {
    return this.rounds.length + 1;
  }

  /** 최대 라운드에 도달했는지 확인한다 */
  isMaxRoundsReached(): boolean {
    return this.rounds.length >= this.config.maxRounds;
  }

  /** 전문가 평가 결과를 기록하고 판정한다 */
  recordRound(
    evaluations: readonly ExpertEvaluation[],
    discussionSummary: string,
  ): ReviewRound {
    const scores: RoundScore[] = evaluations.map((e) => ({
      role: e.role,
      score: e.score,
    }));

    const passed = scores.every((s) => s.score >= this.config.threshold);

    const round: ReviewRound = {
      roundNumber: this.getCurrentRound(),
      selectedExperts: this.selectedExperts,
      evaluations,
      scores,
      discussionSummary,
      passed,
    };

    this.rounds.push(round);
    return round;
  }

  /** 미달 전문가 목록을 반환한다 */
  getFailingExperts(round: ReviewRound): readonly ExpertRole[] {
    return round.scores
      .filter((s) => s.score < this.config.threshold)
      .map((s) => s.role);
  }

  /** 최종 리뷰 결과를 생성한다 */
  getResult(verdict: 'PASS' | 'RETRY' | 'OVERRIDE'): ReviewResult {
    return {
      topic: '',
      rounds: [...this.rounds],
      finalVerdict: verdict,
      selectedExperts: this.selectedExperts,
    };
  }

  /** 전체 라운드 이력을 반환한다 */
  getRounds(): readonly ReviewRound[] {
    return [...this.rounds];
  }

  /** 설정을 반환한다 */
  getConfig(): ReviewEngineConfig {
    return { ...this.config };
  }
}

/** 라운드별 점수표를 포매팅한다 */
export function formatScoreTable(
  rounds: readonly ReviewRound[],
  threshold: number,
): string {
  if (rounds.length === 0) {
    return '(평가 라운드 없음)';
  }

  const latestRound = rounds[rounds.length - 1];
  if (!latestRound) {
    return '(평가 라운드 없음)';
  }

  const allRoles = latestRound.selectedExperts;

  // 헤더 생성
  const roundHeaders = rounds.map((r) => `R${r.roundNumber}`).join(' | ');
  const lines: string[] = [
    `| 전문가 | ${roundHeaders} | 상태 |`,
    `|${'----|'.repeat(rounds.length + 2)}`,
  ];

  // 각 전문가별 라운드 점수
  for (const role of allRoles) {
    const roleScores = rounds.map((r) => {
      const score = r.scores.find((s) => s.role === role);
      return score ? score.score.toFixed(2) : '-';
    });

    const latestScore = latestRound.scores.find((s) => s.role === role);
    const status = latestScore && latestScore.score >= threshold ? '✅' : '❌';

    lines.push(`| ${role} | ${roleScores.join(' | ')} | ${status} |`);
  }

  // 전체 판정
  const overallStatus = latestRound.passed ? 'PASS' : 'RETRY';
  lines.push(`\n전체: **${overallStatus}**`);

  return lines.join('\n');
}
