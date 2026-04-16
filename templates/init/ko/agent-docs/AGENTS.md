# Codex Guide

공통 워크플로우는 `ygg/agent.md`를 먼저 읽습니다.

## Codex 전용 사용법

- Codex에는 `/ygg:*` slash command가 없으므로 `ygg/change/<topic>/` 문서를 직접 따라 작업합니다.
- 구현 전 `proposal.md`, `design.md`, `tasks.md`를 기준으로 범위와 완료 조건을 확인합니다.
- 검증이 필요하면 공용 검증 스크립트 `bash .claude/scripts/ygg-prove.sh`와 프로젝트 빌드/테스트 명령을 직접 실행합니다.
- QA가 성공하면 해당 토픽은 최종 완료 상태이며 즉시 `ygg/change/archive/`로 이동해야 합니다. Codex는 QA 통과 토픽을 active에 남겨두면 안 됩니다.
