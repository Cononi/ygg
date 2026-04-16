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
  config: {
    maxQuestionsPerRound: 1,
  },
  dimensions: [
    {
      name: 'motivation',
      displayName: '왜 필요한가',
      weight: 0.25,
      description: '왜 이 변경이 필요한지 — 동기와 배경의 명확성',
      baseQuestion: '이번 변경이 꼭 필요한 이유를 한 문장으로 정의해주세요. 지금 무엇이 막히고 있고, 바뀐 뒤 무엇이 달라져야 하나요?',
      completionHint: '문제와 기대 결과가 선명해야 proposal의 Why가 정확해집니다.',
      evaluators: [
        {
          type: 'humanistic',
          description: '실제 사용자의 불편/필요가 반영되었는가',
          question: '사용자가 가장 답답함을 느끼는 순간은 언제인가요? 현재 불편 1개와 변경 후 기대 결과 1개를 구체적으로 설명해주세요.',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '해당 도메인에서 이 동기가 타당한가',
          question: '이 문제를 보통 어떤 방식으로 해결하나요? 기존 방식 대비 이번 변경이 필요한 이유와 선택한 방향의 근거를 설명해주세요.',
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
      displayName: '무엇을 바꾸나',
      weight: 0.25,
      description: '변경 범위 — 무엇을 바꾸고 어디까지 영향을 미치는가',
      baseQuestion: '이번 토픽에 반드시 포함할 것과 이번에는 제외할 것을 나눠서 적어주세요. 대상 모듈, 명령, 문서를 함께 밝혀주세요.',
      completionHint: '포함/제외 경계가 명확해야 proposal과 tasks가 흔들리지 않습니다.',
      evaluators: [
        {
          type: 'humanistic',
          description: '변경 범위가 사용자 경험에 미치는 영향을 고려했는가',
          question: '이 변경 후 사용자가 직접 체감해야 하는 변화는 무엇인가요? UI, 워크플로우, 응답성 중 바뀌는 지점을 구체적으로 적어주세요.',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '범위가 기술적으로 합리적인가 (너무 넓거나 좁지 않은가)',
          question: '이 범위가 하나의 변경 단위로 적절한가요? 이번 토픽에 넣을 것과 다음 토픽으로 미룰 것을 각각 알려주세요.',
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
      displayName: '누가 어떻게 쓰나',
      weight: 0.2,
      description: '사용자 시나리오 — 누가 어떤 상황에서 어떻게 사용하는가',
      baseQuestion: '대표 사용자 1명과 엣지 사용자 1명을 정해주세요. 각 사용자가 어떤 입력으로 어떤 결과를 기대하는지 설명해주세요.',
      completionHint: '대표 사용 흐름이 선명해야 proposal의 Capabilities와 design의 Context가 좋아집니다.',
      evaluators: [
        {
          type: 'humanistic',
          description: '다양한 사용자 유형(초보/숙련/엣지)을 고려했는가',
          question: '초보 사용자와 숙련 사용자에게 각각 어떤 경험을 제공해야 하나요? 특히 혼동되기 쉬운 지점이나 실패 시나리오도 적어주세요.',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '시나리오가 도메인 관점에서 현실적인가',
          question: '이 시나리오가 실제 워크플로우에서 자주 발생하나요? 발생 맥락과 선행 조건, 완료 기준을 함께 설명해주세요.',
          autoVerifiable: false,
        },
        {
          type: 'reference',
          description: '유사 기능의 선행 사례가 있는가',
          question: '비슷한 기능을 제공하는 다른 도구나 선행 사례가 있나요? 있다면 어떤 점을 참고하거나 피해야 하나요?',
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
      displayName: '이번에 하지 않을 것',
      weight: 0.15,
      description: '경계 정의 — 하지 않을 것, 범위 밖',
      baseQuestion: '이번 변경에서 하지 않을 것을 명시해주세요. 사용자가 기대할 수 있지만 이번에는 제외하는 항목도 함께 적어주세요.',
      completionHint: '비목표가 분명해야 scope creep를 막고 tasks가 안정됩니다.',
      evaluators: [
        {
          type: 'humanistic',
          description: '경계가 사용자 기대와 충돌하지 않는가',
          question: '사용자가 자연스럽게 기대할 수 있지만 이번에는 제외되는 기능이 있나요? 제외 이유와 안내 방식까지 설명해주세요.',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '기술적으로 경계가 명확한가',
          question: '구현 중 범위가 커지지 않게 막아줄 기술적 기준은 무엇인가요? 완료 판단 기준과 중단 기준을 함께 적어주세요.',
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
      displayName: '영향 받는 곳',
      weight: 0.15,
      description: '영향 분석 — 어떤 파일/모듈/시스템에 영향을 미치는가',
      baseQuestion: '직접 수정할 파일과 간접 영향을 받는 모듈을 구분해서 적어주세요. 문서, CLI, 대시보드 등 영향 지점도 빠뜨리지 마세요.',
      completionHint: '영향 파일과 검증 포인트가 보여야 design/spec/tasks로 자연스럽게 이어집니다.',
      evaluators: [
        {
          type: 'humanistic',
          description: '영향받는 사용자 그룹을 파악했는가',
          question: '이 변경으로 기존 사용자의 흐름이 깨지거나 바뀌는 지점이 있나요? 호환성 영향과 안내 필요 여부를 적어주세요.',
          autoVerifiable: false,
        },
        {
          type: 'domain',
          description: '기술적 영향 범위가 정확한가',
          question: '직접 수정하지 않아도 함께 검토해야 하는 모듈이나 의존성 체인이 있나요? 테스트와 검증 포인트까지 설명해주세요.',
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
