/** ygg:next 스테이지 차원 정의 */

import type { StageDefinition } from '../../types/ygg-point.js'

/**
 * next 스테이지의 평가 차원
 *
 * create가 "무엇을 만들 것인가"를 검증했다면,
 * next는 "어떻게 만들 것인가"의 설계 결정 명확성을 검증한다.
 *
 * 5개 차원 × 4개 평가축 = 최대 20개 ���적 평가 포인트
 * weight 합계 = 1.0
 */
export const nextStageDefinition: StageDefinition = {
  stage: 'next',
  dimensions: [
    {
      name: 'architecture',
      weight: 0.25,
      description: '아키텍처 선택 — 어떤 구조/패턴으로 구현할 것인���',
      baseQuestion: '이 변경을 구현할 때 어떤 아키텍처/패턴을 사용할 건가요? (예: Strategy, Builder, 계층 분리 등)',
      evaluators: [
        {
          type: 'humanistic',
          description: '선택한 아키텍처가 유지보수/이해하기 쉬운가',
          question: '이 구조를 처음 보는 개발자가 쉽게 이해할 수 있나요? 복잡도가 적절한가요?',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '해당 도메인에서 이 아키텍처가 표준적인가',
          question: '이 유형의 문제에 대해 업계에서 일반적으로 사용하는 아키텍처 패턴이 있나요? 선택한 방식이 그와 부합하나요?',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '프로젝트의 기존 아키텍처 패턴과 일관성이 있는가',
          question: '프로젝트에서 이미 사용 중인 설계 패턴(Strategy, Builder, Template Method)과 일관된가요?',
          sources: ['CLAUDE.md', 'src/'],
          autoVerifiable: true,
        },
        {
          type: 'consistency',
          description: '기존 코드 구조와 충돌하지 않는가',
          question: '기존 디렉토리 구조, 모듈 경계, import 패턴과 충돌하는 부분은 없나요?',
          sources: ['src/', 'tsconfig.json'],
          autoVerifiable: true,
        },
      ],
    },
    {
      name: 'tradeoff',
      weight: 0.25,
      description: '트레이드오프 — 선택에 따른 장단점을 인지하고 있는가',
      baseQuestion: '이 설계에서 가장 큰 트레이드오프는 무엇인가요? (예: 성능 vs 단순성, 유연성 vs 복잡도)',
      evaluators: [
        {
          type: 'humanistic',
          description: '트레이드오프가 사용자 경험에 미치는 영향을 고려했는가',
          question: '이 트레이드오프가 최종 사용자의 경험(속도, 안정성, 사용성)에 어떤 영향을 미치나요?',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '기술적으로 합리적인 선택인가',
          question: '대안이 되는 접근 방식은 무엇이고, 왜 그것 대신 현재 방식을 선택하나요?',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '선택한 기술/라이브러리의 알려진 제약을 인지했는가',
          question: '사용하려는 라이브러리/API의 알려진 제약이나 주의사항이 있나요?',
          sources: ['package.json'],
          autoVerifiable: true,
        },
        {
          type: 'consistency',
          description: '기존 설계 결정과 모순되지 않는가',
          question: '프로젝트에서 이전에 내린 설계 결정(예: Result 패턴, throw 금지)과 모순되지 않나요?',
          sources: ['CLAUDE.md'],
          autoVerifiable: true,
        },
      ],
    },
    {
      name: 'constraint',
      weight: 0.2,
      description: '제약 조건 — 기술적/비기능적 제약을 파악했는가',
      baseQuestion: '��� 구현에서 반드시 지켜야 할 제약 조건이 있나요? (성능, 보안, 호환성, 테스트 등)',
      evaluators: [
        {
          type: 'humanistic',
          description: '사용자가 기대하는 비기능 요구사항을 반영했는가',
          question: '사용자가 기대하는 성능, 응답 시간, 또는 안정성 수준이 있나요?',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '도메인 고유의 제약(보안, 규정 등)을 고려했는가',
          question: '이 도메인에서 특별히 준수해야 할 보안, 규정, 또는 표준이 있나요?',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '프로젝트 컨벤��(strict mode, lint 등)을 준수하는가',
          question: '프로젝트의 strict mode, lint 규칙, 코딩 컨벤션과 충돌하는 구현이 필요하지 않은가요?',
          sources: ['CLAUDE.md', 'tsconfig.json', 'eslint.config'],
          autoVerifiable: true,
        },
        {
          type: 'consistency',
          description: 'Node.js/TypeScript 버전 등 런타임 제약과 호환되는가',
          question: '대상 Node.js 버전(>=20), TypeScript strict mode 등 런타임 제약과 호환되나요?',
          sources: ['package.json', 'tsconfig.json'],
          autoVerifiable: true,
        },
      ],
    },
    {
      name: 'dependency',
      weight: 0.15,
      description: '의존성 — 구현 순서와 모듈 간 의존 관계를 파악했는가',
      baseQuestion: '이 변경의 구현 순서에서 먼저 해야 할 것과 나중에 해야 할 것이 있나요? 모듈 간 의존 관계는?',
      evaluators: [
        {
          type: 'humanistic',
          description: '점진적 배포/롤아웃이 가능한 순서인가',
          question: '구현을 단계별로 배포할 수 있나요? 부분 구현 상태에서도 시스템이 정상 동작하나요?',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '의존성 방향이 기술적으로 올바른가',
          question: '의존성 방향이 올바른가요? 순환 의존이나 역방향 의존이 생기지 않나요?',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '새 의존성이 프로젝트 정책에 부합하는가',
          question: '새로운 외부 패키지가 필요하나요? 있다면 프로젝트의 의존성 정책(최소 의존성 원칙 등)에 부합하나요?',
          sources: ['package.json'],
          autoVerifiable: true,
        },
        {
          type: 'consistency',
          description: '기존 모듈의 import 구조와 일관성을 유지하는가',
          question: '새 모듈의 위치와 import 경로가 기존 구조(core/, generators/, utils/ 등)와 일관되나요?',
          sources: ['src/'],
          autoVerifiable: true,
        },
      ],
    },
    {
      name: 'rollback',
      weight: 0.15,
      description: '롤백 계획 — 문제 발생 시 되돌릴 수 있는가',
      baseQuestion: '이 변경에서 문제가 발생하면 어떻게 되돌리나요? 롤백 전략이 있나요?',
      evaluators: [
        {
          type: 'humanistic',
          description: '롤백 시 사용자 데이터/경험에 영향이 없는가',
          question: '롤백 시 사용자가 이미 생성한 데이터나 설정이 손실되지 않나요?',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '기술적으로 안전한 롤백이 가능한가',
          question: '스키마 변경이나 데���터 마이그레이션이 포함된다면 역방향 마이그레이션이 가능한가요?',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '기존 테스트가 롤백 후에도 통과하는가',
          question: '롤백 후 기존 테스트 스위트가 모�� 통과하는 상태로 돌아갈 수 있나요?',
          sources: ['test/'],
          autoVerifiable: true,
        },
        {
          type: 'consistency',
          description: '최근 변경사항과의 롤백 충돌이 없는가',
          question: '이 변경 이후에 다른 변경이 들어오면 롤백이 충돌할 수 있나요? 독립적으로 되돌릴 수 있나요?',
          sources: ['git log'],
          autoVerifiable: true,
        },
      ],
    },
  ],
}
