/** review.md 보고서 생성기 */

import { getExpertByRole } from '../core/dimensions/teams-stage.js';
import { formatScoreTable } from '../core/review-engine.js';
import type {
  ReviewResult,
  ReviewRound,
  ExpertEvaluation,
} from '../types/expert-review.js';

/** 단일 라운드의 review.md 내용을 생성한다 */
export function generateRoundReport(
  topic: string,
  round: ReviewRound,
  allRounds: readonly ReviewRound[],
  threshold: number,
): string {
  const lines: string[] = [];

  lines.push(`# Expert Review: ${topic} — Round ${round.roundNumber}`);
  lines.push('');

  // 선별된 전문가
  lines.push('## 선별된 전문가');
  lines.push('');
  lines.push('| 전문가 | 역할 |');
  lines.push('|---|---|');
  for (const role of round.selectedExperts) {
    const expert = getExpertByRole(role);
    if (expert) {
      lines.push(`| ${expert.icon} ${expert.name} | ${expert.description} |`);
    }
  }
  lines.push('');

  // 전문가별 평가
  lines.push('## 전문가별 평가');
  lines.push('');
  for (const evaluation of round.evaluations) {
    lines.push(formatEvaluation(evaluation));
    lines.push('');
  }

  // 토론 요약
  lines.push('## 전문가 간 토론 요약');
  lines.push('');
  lines.push(round.discussionSummary);
  lines.push('');

  // 점수표
  lines.push('## 점수표');
  lines.push('');
  lines.push(formatScoreTable(allRounds, threshold));
  lines.push('');

  // 종합 판정
  lines.push('## 종합 판정');
  lines.push('');
  if (round.passed) {
    lines.push('**PASS** — 선별된 전문가 전원 0.95 이상 달성. 구현 단계로 진행 가능.');
  } else {
    const failing = round.scores
      .filter((s) => s.score < threshold)
      .map((s) => {
        const expert = getExpertByRole(s.role);
        return expert ? `${expert.icon} ${expert.name} (${s.score.toFixed(2)})` : s.role;
      });
    lines.push(`**RETRY** — 미달 영역: ${failing.join(', ')}`);
    lines.push('');
    lines.push('### 미달 영역 수정 방향');
    lines.push('');
    for (const evaluation of round.evaluations) {
      const score = round.scores.find((s) => s.role === evaluation.role);
      if (score && score.score < threshold) {
        const expert = getExpertByRole(evaluation.role);
        lines.push(`#### ${expert?.icon ?? ''} ${expert?.name ?? evaluation.role}`);
        for (const issue of evaluation.issues) {
          lines.push(`- **[${issue.severity}]** ${issue.description}`);
          lines.push(`  → ${issue.recommendation}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/** 전체 리뷰 결과의 최종 보고서를 생성한다 */
export function generateFinalReport(
  result: ReviewResult,
  threshold: number,
): string {
  const latestRound = result.rounds[result.rounds.length - 1];
  if (!latestRound) {
    return '(평가 결과 없음)';
  }

  return generateRoundReport(
    result.topic,
    latestRound,
    result.rounds,
    threshold,
  );
}

/** 개별 전문가 평가를 포매팅한다 */
function formatEvaluation(evaluation: ExpertEvaluation): string {
  const expert = getExpertByRole(evaluation.role);
  const lines: string[] = [];

  lines.push(`### ${expert?.icon ?? ''} ${expert?.name ?? evaluation.role}`);
  lines.push('');
  lines.push(`**점수:** ${evaluation.score.toFixed(2)}`);
  lines.push('');

  if (evaluation.strengths.length > 0) {
    lines.push('**강점:**');
    for (const strength of evaluation.strengths) {
      lines.push(`- ${strength}`);
    }
    lines.push('');
  }

  if (evaluation.issues.length > 0) {
    lines.push('**이슈:**');
    for (const issue of evaluation.issues) {
      lines.push(`- **[${issue.severity}]** ${issue.description}`);
      lines.push(`  → 수정 방향: ${issue.recommendation}`);
    }
    lines.push('');
  }

  lines.push(`**종합:** ${evaluation.summary}`);

  return lines.join('\n');
}
