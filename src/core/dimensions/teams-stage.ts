/** 전문가 팀 평가 — 전문가별 정의 및 채점 기준 */

import type { ExpertDefinition, ExpertRole } from '../../types/expert-review.js';

/** 5종 전문가 정의 */
export const EXPERT_DEFINITIONS: readonly ExpertDefinition[] = [
  {
    role: 'architect',
    name: '아키텍처 전문가',
    icon: '🏗️',
    description: '기술 설계의 확장성, 패턴 적합성, 모듈 분리, 의존성 구조를 검증',
    evaluationCriteria: [
      '확장성 — 향후 요구사항 변경에 유연하게 대응할 수 있는가',
      '패턴 적합성 — 선택한 설계 패턴이 문제에 적합한가',
      '모듈 분리 — 관심사가 적절히 분리되어 있는가',
      '의존성 구조 — 의존성 방향이 올바른가',
      '단순성 — 불필요한 복잡성 없이 문제를 해결하는가',
    ],
    selectionKeywords: [
      '모듈', '계층', 'api', '의존성', '구조', '아키텍처', '패턴',
      '인터페이스', '추상화', '분리', '결합도', '확장',
    ],
    scoringRubric: {
      ranges: [
        { min: 0.0, max: 0.3, description: '설계가 존재하지 않거나 근본적 결함 (순환 의존, 신뢰할 수 없는 구조)' },
        { min: 0.3, max: 0.6, description: '기본 구조는 있으나 확장성/모듈 분리에 심각한 문제' },
        { min: 0.6, max: 0.8, description: '전반적으로 양호하나 개선 필요 (패턴 불일치, 결합도 높음)' },
        { min: 0.8, max: 0.95, description: '대부분 견고하나 사소한 개선점이 남아 있음' },
        { min: 0.95, max: 1.0, description: '확장성, 패턴, 모듈 분리, 의존성 모두 우수' },
      ],
    },
  },
  {
    role: 'uiux',
    name: 'UI/UX 전문가',
    icon: '🎨',
    description: 'DX(Developer Experience), 인터페이스 직관성, 에러 메시지 품질을 검증',
    evaluationCriteria: [
      'DX — 개발자가 쉽고 직관적으로 사용할 수 있는가',
      '일관성 — 기존 명령어/인터페이스와 일관적인가',
      '에러 처리 — 에러 메시지가 명확하고 해결 방법을 안내하는가',
      '학습 곡선 — 처음 사용하는 개발자가 쉽게 이해할 수 있는가',
      '피드백 — 사용자에게 충분한 진행 상태와 결과를 알려주는가',
    ],
    selectionKeywords: [
      'cli', '인터페이스', '명령어', '출력', '에러 메시지', 'ux', 'dx',
      '사용성', '사용자 경험', '포맷', '표시', '안내',
    ],
    scoringRubric: {
      ranges: [
        { min: 0.0, max: 0.3, description: '사용자 인터페이스가 혼란스럽거나 에러 메시지 없음' },
        { min: 0.3, max: 0.6, description: '기본 기능은 동작하나 직관성/일관성 부족' },
        { min: 0.6, max: 0.8, description: '대체로 양호하나 DX 개선점 존재' },
        { min: 0.8, max: 0.95, description: '직관적이고 일관적이나 세부 개선 여지' },
        { min: 0.95, max: 1.0, description: 'DX, 일관성, 에러 처리, 피드백 모두 우수' },
      ],
    },
  },
  {
    role: 'data',
    name: '데이터 전문가',
    icon: '📊',
    description: '스키마 설계, 데이터 흐름, 일관성, 유효성 검증을 검증',
    evaluationCriteria: [
      '스키마 설계 — 데이터 구조가 명확하고 정규화되어 있는가',
      '데이터 흐름 — 입력에서 출력까지 데이터 변환이 추적 가능한가',
      '유효성 검증 — 입력 데이터의 유효성을 적절히 검증하는가',
      '일관성 — 데이터 형식이 시스템 전체에서 일관적인가',
      '진화 가능성 — 스키마가 향후 변경에 대응할 수 있는가',
    ],
    selectionKeywords: [
      '스키마', 'db', 'json', '데이터', '파싱', '직렬화', '타입',
      '모델', '유효성', '검증', 'zod', '변환', '마이그레이션',
    ],
    scoringRubric: {
      ranges: [
        { min: 0.0, max: 0.3, description: '데이터 구조가 정의되지 않았거나 근본적 결함' },
        { min: 0.3, max: 0.6, description: '기본 스키마는 있으나 유효성 검증/일관성 부족' },
        { min: 0.6, max: 0.8, description: '대체로 양호하나 데이터 흐름/진화 가능성에 문제' },
        { min: 0.8, max: 0.95, description: '견고하나 세부 개선점이 남아 있음' },
        { min: 0.95, max: 1.0, description: '스키마, 흐름, 유효성, 일관성 모두 우수' },
      ],
    },
  },
  {
    role: 'security',
    name: '보안 전문가',
    icon: '🔒',
    description: '취약점 분석, 인증/인가, OWASP 대응, 입력 검증을 검증',
    evaluationCriteria: [
      '입력 검증 — 외부 입력을 적절히 검증/새니타이징하는가',
      '인증/인가 — 접근 제어가 올바르게 설계되어 있는가',
      '파일 접근 — 경로 조작(path traversal) 등의 위험이 없는가',
      '환경변수/시크릿 — 민감 정보가 안전하게 관리되는가',
      '최소 권한 — 필요 최소한의 권한만 요구하는가',
    ],
    selectionKeywords: [
      '인증', '권한', '입력 검증', '파일 접근', '환경변수', '보안',
      '시크릿', '토큰', '세션', 'permission', '새니타이징',
    ],
    scoringRubric: {
      ranges: [
        { min: 0.0, max: 0.3, description: '심각한 보안 취약점 존재 (인젝션, 경로 조작 등)' },
        { min: 0.3, max: 0.6, description: '기본 보안은 있으나 중요한 취약점 존재' },
        { min: 0.6, max: 0.8, description: '대체로 안전하나 개선 필요 (입력 검증 미흡 등)' },
        { min: 0.8, max: 0.95, description: '대부분 안전하나 세부 개선 여지' },
        { min: 0.95, max: 1.0, description: '입력 검증, 인증, 파일 접근, 최소 권한 모두 충족' },
      ],
    },
  },
  {
    role: 'performance',
    name: '성능 전문가',
    icon: '⚡',
    description: '병목 분석, 리소스 효율, 최적화 기회를 검증',
    evaluationCriteria: [
      '병목 — 명백한 성능 병목이 없는가',
      '리소스 효율 — 메모리/CPU/I/O를 효율적으로 사용하는가',
      '토큰 비용 — LLM 토큰 사용이 최적화되어 있는가',
      '확장성 — 데이터/사용자 증가에 따른 성능 저하가 없는가',
      '캐싱 — 반복 작업에 대한 캐싱 전략이 있는가',
    ],
    selectionKeywords: [
      '대량 처리', '병렬', '캐싱', 'i/o', '토큰 비용', '성능',
      '최적화', '메모리', '속도', '병목', '비동기', '배치',
    ],
    scoringRubric: {
      ranges: [
        { min: 0.0, max: 0.3, description: '심각한 성능 문제 (O(n²) 이상, 메모리 누수 등)' },
        { min: 0.3, max: 0.6, description: '동작하나 명백한 병목 존재' },
        { min: 0.6, max: 0.8, description: '대체로 효율적이나 최적화 기회 존재' },
        { min: 0.8, max: 0.95, description: '대부분 효율적이나 세부 개선 여지' },
        { min: 0.95, max: 1.0, description: '병목 없음, 리소스 효율적, 토큰 비용 최적화' },
      ],
    },
  },
] as const;

/** 역할명으로 전문가 정의를 조회한다 */
export function getExpertByRole(role: ExpertRole): ExpertDefinition | undefined {
  return EXPERT_DEFINITIONS.find((e) => e.role === role);
}

/** 모든 전문가 역할 목록을 반환한다 */
export function getAllRoles(): readonly ExpertRole[] {
  return EXPERT_DEFINITIONS.map((e) => e.role);
}
