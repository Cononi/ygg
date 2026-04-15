/** ygg:create 스테이지 차원 정의 */

import type { StageDefinition } from '../../types/ygg-point.js'

/**
 * create 스테이지의 평가 차원
 *
 * 5개 차원 × 4개 평가축 = 최대 20개 질적 평가 포인트
 * weight 합계 = 1.0
 */
export const createStageDefinition: StageDefinition = {
  stage: 'create',
  dimensions: [
    {
      name: 'motivation',
      weight: 0.25,
      description: '왜 이 변경이 필요한지 — 동기와 배경의 명확성',
      baseQuestion: '이 기능/변경이 필요한 이유와 배경을 설명해주세요. 어떤 문제를 해결하려는 건가요?',
      evaluators: [
        {
          type: 'humanistic',
          description: '실제 사용자의 불편/필요가 반영되었는가',
          question: '이 변경으로 최종 사용자가 겪는 구체적인 불편이나 필요는 무엇인가요?',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '해당 도메인에서 이 동기가 타당한가',
          question: '이 문제가 해당 도메인(분야)에서 일반적으로 어떻게 다뤄지나요? 업계 표준이나 관례가 있나요?',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '관련 문서/이슈/RFC가 존재하는가',
          question: '이 변경과 관련된 참고 문서, 이슈, 또는 RFC가 있나요?',
          sources: ['CLAUDE.md', 'ygg/spec/'],
          autoVerifiable: true,
        },
        {
          type: 'consistency',
          description: '최근 변경사항과 동기가 충돌하지 않는가',
          question: '최근 이 영역에서 변경된 사항이 있나요? 이 변경과 충돌하거나 중복되지 않나요?',
          sources: ['git log'],
          autoVerifiable: true,
        },
      ],
    },
    {
      name: 'scope',
      weight: 0.25,
      description: '변경 범위 — 무엇을 바꾸고 어디까지 영향을 미치는가',
      baseQuestion: '이 변경의 구체적인 범위를 알려주세요. 어떤 모듈/파일/기능이 대상인가요?',
      evaluators: [
        {
          type: 'humanistic',
          description: '변경 범위가 사용자 경험에 미치는 영향을 고려했는가',
          question: '이 변경이 사용자 경험(UI, 워크플로우, 성능)에 어떤 영향을 미치나요?',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '범위가 기술적으로 합리적인가 (너무 넓거나 좁지 않은가)',
          question: '이 범위가 하나의 변경 단위로 적절한가요? 더 작게 나누거나 합쳐야 할 부분이 있나요?',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '변경 대상이 공식 API/스키마와 호환되는가',
          question: '변경 대상 모듈이 사용하는 외부 API나 스키마의 최신 버전을 확인했나요?',
          sources: ['package.json', 'ygg/spec/'],
          autoVerifiable: true,
        },
        {
          type: 'consistency',
          description: '기존 코드 구조/컨벤션과 일관성을 유지하는가',
          question: '이 변경이 기존 코드 컨벤션(네이밍, 패턴, 디렉토리 구조)과 일관된가요?',
          sources: ['CLAUDE.md', 'eslint config'],
          autoVerifiable: true,
        },
      ],
    },
    {
      name: 'user-story',
      weight: 0.2,
      description: '사용자 시나리오 — 누가 어떤 상황에서 어떻게 사용하는가',
      baseQuestion: '이 기능의 주 사용자는 누구이고, 어떤 시나리오에서 사용하게 되나요?',
      evaluators: [
        {
          type: 'humanistic',
          description: '다양한 사용자 유형(초보/숙련/엣지)을 고려했는가',
          question: '처음 사용하는 사람과 숙련된 사용자 모두에게 적절한 경험을 제공하나요? 엣지 케이스 사용자는?',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '시나리오가 도메인 관점에서 현실적인가',
          question: '이 시나리오가 실제 워크플로우에서 자연스럽게 발생하는 상황인가요?',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '유사 기능의 선행 사례가 있는가',
          question: '비슷한 기능을 제공하는 다른 도구/시스템이 있나요? 참고할 수 있는 선행 사례는?',
          autoVerifiable: false,
        },
        {
          type: 'consistency',
          description: '기존 사용자 흐름과 자연스럽게 연결되는가',
          question: '이 기능이 기존 워크플로우(파이프라인, 명령어 체계)와 자연스럽게 연결되나요?',
          sources: ['ygg-core SKILL.md'],
          autoVerifiable: true,
        },
      ],
    },
    {
      name: 'boundary',
      weight: 0.15,
      description: '경계 정의 — 하지 않을 것, 범위 밖',
      baseQuestion: '이 변경에서 명시적으로 하지 않을 것(Non-Goals)은 무엇인가요?',
      evaluators: [
        {
          type: 'humanistic',
          description: '경계가 사용자 기대와 충돌하지 않는가',
          question: '사용자가 이 기능에서 당연히 기대할 수 있지만 제외된 것이 있나요? 그 이유는?',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '기술적으로 경계가 명확한가',
          question: '구현 시 "여기까지만" 하는 기준이 기술적으로 명확한가요?',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '경계 밖의 기능이 향후 로드맵에 있는가',
          question: '제외된 범위가 향후 구현 예정인가요, 아니면 영구적으로 범위 밖인가요?',
          sources: ['CLAUDE.md'],
          autoVerifiable: true,
        },
        {
          type: 'consistency',
          description: '기존 기능과의 경계가 충돌하지 않는가',
          question: '기존 기능 중 이 변경의 경계와 겹치거나 충돌하는 것이 있나요?',
          sources: ['git log'],
          autoVerifiable: true,
        },
      ],
    },
    {
      name: 'impact',
      weight: 0.15,
      description: '영향 분석 — 어떤 파일/모듈/시스템에 영향을 미치는가',
      baseQuestion: '이 변경으로 영향받는 파일, 모듈, 또는 시스템은 무엇인가요?',
      evaluators: [
        {
          type: 'humanistic',
          description: '영향받는 사용자 그룹을 파악했는가',
          question: '이 변경이 기존 사용자의 워크플로우를 깨뜨리거나 변경하는 부분이 있나요?',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '기술적 영향 범위가 정확한가',
          question: '간접적으로 영향받는 모듈(의존성 체인)까지 고려했나요?',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '영향받는 API/스키마의 하위 호환성을 확인했는가',
          question: '이 변경이 외부에 노출된 API나 스키마의 하위 호환성을 깨뜨리나요?',
          sources: ['package.json'],
          autoVerifiable: true,
        },
        {
          type: 'consistency',
          description: '최근 버그픽스와 충돌하지 않는가',
          question: '최근 수정된 버그나 핫픽스 영역과 이 변경이 겹치나요?',
          sources: ['git log'],
          autoVerifiable: true,
        },
      ],
    },
  ],
}
