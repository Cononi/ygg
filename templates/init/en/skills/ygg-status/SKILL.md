---
name: ygg-status
description: "Show implementation progress dashboard. Reads `ygg/change/INDEX.md` and active topics' `tasks.md` files to display per-phase and overall completion rates. Triggered by /ygg:status command."
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
