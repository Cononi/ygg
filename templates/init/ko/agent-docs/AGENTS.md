# Codex Guide

공통 워크플로우는 `ygg/agent.md`를 먼저 읽습니다.

## Codex 전용 사용법

- `AGENTS.md`는 Codex용 하네스 진입점입니다. 전체 절차를 길게 적는 문서가 아니라 저장소 내 소스 오브 트루스로 연결해 주는 인덱스로 취급합니다.
- Codex 런타임 지침은 `AGENTS.md`와 `.codex/skills/`만 따릅니다. `.claude/commands`나 Claude 전용 hook 규칙을 Codex 실행 규칙으로 따라가면 안 됩니다.
- 다만 ygg 자체를 수정할 때 `.claude/`는 여전히 편집 대상 소스 파일일 수 있습니다. 이 경우에도 그것은 구현 산출물이지 Codex 운영 지침은 아닙니다.
- Codex에는 `/ygg:*` slash command가 없으므로 `ygg/change/<topic>/` 문서를 직접 따라 작업합니다.
- 구현 전 `proposal.md`, `design.md`, `tasks.md`를 기준으로 범위와 완료 조건을 확인합니다.
- 검증이 필요하면 공용 검증 스크립트 `bash ygg/scripts/ygg-prove.sh`와 프로젝트 빌드/테스트 명령을 직접 실행합니다.
- QA가 성공하면 해당 토픽은 최종 완료 상태이며 즉시 `ygg/change/archive/`로 이동해야 합니다. Codex는 QA 통과 토픽을 active에 남겨두면 안 됩니다.
