---
name: ygg-status
description: "현재 구현 진행 현황 대시보드. `ygg/change/INDEX.md`와 활성 토픽의 `tasks.md`를 읽어 페이즈별/전체 완료율 표시. /ygg:status 커맨드로 실행."
allowed_tools:
  - Read
  - Glob
---

# ygg-status — Progress Dashboard

1. Read `ygg/change/INDEX.md`
2. Parse `[x]`/`[ ]` items from active topics' tasks.md
3. Calculate per-phase and overall completion %
4. Show recent completed items + recent changes
5. Suggest next action
