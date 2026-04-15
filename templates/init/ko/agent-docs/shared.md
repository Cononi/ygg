# YGG Agent Workflow

이 프로젝트는 `ygg/change/`를 기준으로 변경 단위를 관리합니다.

## 공통 규칙

1. 작업 전에 `ygg/change/INDEX.md`와 활성 토픽의 `proposal.md`, `design.md`, `tasks.md`를 읽습니다.
2. 구현은 항상 `tasks.md` 범위 안에서 진행하고, 범위 밖 변경은 먼저 명시합니다.
3. 변경 후에는 빌드, 테스트, 린트, 타입체크 등 적용 가능한 검증을 수행합니다.
4. 구현 중 결정사항과 검증 결과는 활성 토픽 문서에 반영합니다.
5. 작은 단위로 수정하고, 이미 존재하는 코드 스타일과 구조를 따릅니다.
6. QA가 성공하면 해당 활성 토픽은 최종 완료로 간주하며 즉시 `ygg/change/archive/`로 이동해야 합니다. 어떤 AI 워크플로우에서도 QA 통과 토픽을 active에 남겨두면 안 됩니다.

## 표준 흐름

1. `proposal.md`에 변경 목적과 범위를 정리
2. `design.md`와 `specs/`에서 설계/요구사항 확정
3. `tasks.md` 체크리스트 순서대로 구현
4. QA를 실행하고 검증 결과를 문서에 남김
5. QA 성공 시 완료 처리와 archive 이동을 즉시 수행

## 단계별 역할

1. `ygg-create`는 proposal을 만들고 워크플로우를 시작합니다.
2. `ygg-next`는 design/spec/tasks를 작성해 구현 계획을 확정합니다.
3. `ygg-add`는 tasks.md 순서대로 구현하고 변경 로그를 남깁니다.
4. `ygg-qa`는 실제 명령으로 검증하고, 통과 시 완료 처리와 archive 이동까지 끝냅니다.

## 핵심 경로

- 변경 목록: `ygg/change/INDEX.md`
- 활성 토픽: `ygg/change/<topic>/`
- 검증 스크립트: `bash .claude/scripts/ygg-prove.sh`

`.claude/` 디렉토리가 있으면 Claude용 slash command, skills, hooks를 그대로 사용합니다.
