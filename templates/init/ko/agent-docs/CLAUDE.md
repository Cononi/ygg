# Claude Guide

공통 워크플로우는 `ygg/agent.md`를 먼저 읽습니다.

## Claude 전용 사용법

- `CLAUDE.md`는 Claude용 하네스 진입점입니다. slash command, hook, Claude skill이 연결된 지도를 제공하는 문서로 취급합니다.
- Claude 런타임 지침은 `CLAUDE.md`, `.claude/commands/`, `.claude/skills/`, `.claude/settings.json`만 따릅니다. `AGENTS.md`나 `.codex/skills/`를 Claude 실행 규칙으로 해석하면 안 됩니다.
- ygg 자체를 수정할 때 `AGENTS.md`와 `.codex/`도 편집 대상이 될 수 있지만, 그것은 출력 타깃 관리이지 Claude 운영 지침이 아닙니다.
- `/ygg:create`, `/ygg:next`, `/ygg:add`, `/ygg:qa`, `/ygg:status`, `/ygg:prove` 순서로 진행합니다.
- 세부 규칙과 자동화는 `.claude/commands/ygg/`, `.claude/skills/`, `.claude/settings.json`을 따릅니다.
- hook 경고가 나오면 무시하지 말고 활성 토픽 문서와 작업 범위를 먼저 맞춥니다.
- `/ygg:qa`가 성공하면 해당 토픽은 최종 완료로 간주하고 즉시 archive로 이동해야 합니다. Claude 워크플로우에서 QA 통과 토픽을 active에 남겨두면 안 됩니다.
