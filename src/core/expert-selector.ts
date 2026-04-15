/** 전문가 자동 선별 엔진 — 설계 문서를 분석하여 관련 전문가만 선별 */

import type {
  ExpertRole,
  ExpertDefinition,
  ExpertSelectionResult,
  ReviewEngineConfig,
} from '../types/expert-review.js';

import { EXPERT_DEFINITIONS } from './dimensions/teams-stage.js';

/** 설계 문서 내용에서 각 전문가의 관련도를 계산한다 */
function computeRelevance(
  content: string,
  expert: ExpertDefinition,
): number {
  const lowerContent = content.toLowerCase();
  let matchCount = 0;

  for (const keyword of expert.selectionKeywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  if (expert.selectionKeywords.length === 0) {
    return 0;
  }

  return matchCount / expert.selectionKeywords.length;
}

/** 설계 문서를 분석하여 관련 전문가를 자동 선별한다 */
export function selectExperts(
  proposalContent: string,
  designContent: string,
  config: Pick<ReviewEngineConfig, 'minExperts' | 'maxExperts'>,
): ExpertSelectionResult {
  const combinedContent = `${proposalContent}\n${designContent}`;

  // 각 전문가별 관련도 계산
  const relevanceScores: Array<{ role: ExpertRole; score: number; reason: string }> = [];

  for (const expert of EXPERT_DEFINITIONS) {
    const score = computeRelevance(combinedContent, expert);
    const matchedKeywords = expert.selectionKeywords.filter((kw) =>
      combinedContent.toLowerCase().includes(kw.toLowerCase()),
    );

    const reason =
      matchedKeywords.length > 0
        ? `관련 키워드 감지: ${matchedKeywords.join(', ')}`
        : '관련 키워드 없음';

    relevanceScores.push({ role: expert.role, score, reason });
  }

  // 관련도 높은 순으로 정렬
  relevanceScores.sort((a, b) => b.score - a.score);

  // 최소/최대 인원 제약 적용
  const selected: ExpertRole[] = [];
  const reasons = new Map<ExpertRole, string>();
  const excluded: ExpertRole[] = [];

  for (const { role, score, reason } of relevanceScores) {
    if (selected.length < config.maxExperts && score > 0) {
      selected.push(role);
      reasons.set(role, reason);
    } else {
      excluded.push(role);
    }
  }

  // 최소 인원 보장: 관련도가 0이어도 상위 전문가를 포함
  if (selected.length < config.minExperts) {
    for (const { role, reason } of relevanceScores) {
      if (!selected.includes(role) && selected.length < config.minExperts) {
        selected.push(role);
        reasons.set(role, `${reason} (최소 인원 보장으로 포함)`);
        const excludedIdx = excluded.indexOf(role);
        if (excludedIdx !== -1) {
          excluded.splice(excludedIdx, 1);
        }
      }
    }
  }

  return {
    selected,
    reasons,
    excluded,
  };
}

/** 선별 결과를 사람이 읽기 좋은 문자열로 포매팅한다 */
export function formatSelectionResult(result: ExpertSelectionResult): string {
  const lines: string[] = ['## 선별된 전문가', '', '| 전문가 | 선별 이유 |', '|---|---|'];

  for (const role of result.selected) {
    const expert = EXPERT_DEFINITIONS.find((e) => e.role === role);
    if (expert) {
      const reason = result.reasons.get(role) ?? '알 수 없음';
      lines.push(`| ${expert.icon} ${expert.name} | ${reason} |`);
    }
  }

  if (result.excluded.length > 0) {
    lines.push('', '**제외된 전문가:**');
    for (const role of result.excluded) {
      const expert = EXPERT_DEFINITIONS.find((e) => e.role === role);
      if (expert) {
        lines.push(`- ${expert.icon} ${expert.name}`);
      }
    }
  }

  return lines.join('\n');
}
