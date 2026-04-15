import type { Messages } from './types.js'

export const ko = {
  commands: {
    create: {
      description:
        '새 기능/수정 제안서(proposal) 작성. YGG Point 스코어링으로 명세 완성도를 검증',
    },
    next: {
      description: '활성 proposal의 설계(design), 스펙(spec), 작업 목록(tasks) 수립',
    },
    add: {
      description: '활성 change plan의 작업(task)을 순서대로 구현. 스펙 제약사항 준수',
    },
    qa: {
      description:
        '구현 결과 검증. 빌드/테스트/린트/타입체크 후 스펙 대비 pass/fail 리포트',
    },
    status: {
      description: '현재 구현 진행 현황 대시보드. 페이즈별/전체 완료율 표시',
    },
    prove: {
      description:
        'ygg 시스템 전체 검증. 디렉토리, agents, commands, skills 설치 상태 테스트',
    },
    lang: {
      description: 'ygg 시스템 언어 설정. ygg/config.yml에 저장',
    },
  },
  skills: {
    create: {
      description:
        '새 기능/수정 제안서(proposal) 작성. YGG Point 스코어링으로 명세 완성도를 검증하고, 충분히 명확해질 때까지 질문을 던짐. /ygg:create 커맨드로 실행.',
      askInitial: '어떤 기능/수정을 만들고 싶으신가요? 자연어로 설명해주세요.',
      scoreReady: "Proposal '{{topic}}' 생성 완료 (YGG Point: {{score}}). 다음 단계를 선택하세요.",
      nextSteps: '설계 단계로 계속 — design + spec + tasks 수립',
    },
    next: {
      description:
        '활성 proposal의 설계(design), 스펙(spec), 작업 목록(tasks) 수립. 아키텍처 결정사항을 YGG Point로 검증. /ygg:next 커맨드로 실행.',
      planReady:
        "'{{topic}}' 계획 수립 완료 (YGG Point: {{score}}). Design {{decisions}}개 결정, Spec {{specs}}개 컴포넌트, Tasks {{tasks}}개 항목.",
      nextSteps: '구현 시작',
    },
    add: {
      description:
        '활성 change plan의 작업(task)을 순서대로 구현. 스펙 제약사항을 따르며 일일 변경사항 기록. /ygg:add 커맨드로 실행.',
      taskStatus: "'{{topic}}' 태스크 목록입니다 ({{done}}/{{total}} 완료). 어떻게 진행할까요?",
      nextSteps: '전체 미완료 태스크 구현 시작',
      qaPrompt: "'{{topic}}' 구현 완료. 검증 태스크가 남아있습니다. 다음 단계를 선택하세요.",
    },
    qa: {
      description:
        '구현 결과 검증. 빌드/테스트/린트/타입체크 실행 후 스펙 요구사항 대비 증거 기반 pass/fail 리포트. /ygg:qa 커맨드로 실행.',
    },
    status: {
      description:
        '현재 구현 진행 현황 대시보드. ygg/progress/ 체크박스를 파싱하여 페이즈별/전체 완료율 표시. /ygg:status 커맨드로 실행.',
    },
    prove: {
      description:
        'ygg 시스템 전체 검증. 디렉토리 구조, agents, commands, skills, hooks, scripts 설치 상태를 테스트. /ygg:prove 커맨드로 실행.',
    },
    lang: {
      description: 'ygg 시스템 언어 설정. 선택한 언어를 ygg/config.yml에 저장. /ygg:lang 커맨드로 실행.',
      selectLang: 'ygg 시스템에서 사용할 언어를 선택하세요.',
      saved: "언어가 '{{lang}}'(으)로 설정되었습니다. 다음 generate/init 시 적용됩니다.",
    },
    core: {
      description:
        '모든 /ygg:* 커맨드의 공유 규칙과 포맷 정의. OpenSpec-like 파이프라인(create→next→add→qa), per-change 디렉토리 구조, 문서 포맷, AskUserQuestion 상호작용 규칙. ygg skill과 함께 자동 활성화.',
    },
  },
} as const satisfies Messages
