---
name: ygg-add
description: "Implement tasks from the active change plan in order, following spec constraints. Records daily changes. Triggered by /ygg:add command."
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# ygg-add — Task Review & Implementation

Refer to `ygg-core` for shared rules and formats.

## Workflow

1. **Find active topic** — locate stage=`next`/`add` topic in INDEX.md (see ygg-core)
2. **Read documents** — tasks.md, design.md, specs/
3. **Show task status** — ✅/⬜ list + completion rate
4. **Choose implementation mode** — AskUserQuestion: "Implement all (Recommended)" / "Select specific tasks" / "Modify requirements" / "Cancel"
5. **Implement per task** — check spec → write code → lint/typecheck → check tasks.md → record change log
6. **Change log** — `ygg/change/{topic}/{YYYY-MM-DD}.md`: Why, Spec, Changes, Tasks
7. **Update INDEX.md** — change stage to `add` on first implementation
8. **After completion** — AskUserQuestion: "Start verification (Recommended)" / "Continue implementing" / "Stop"
9. **Auto-chain** — if "Start verification" selected, immediately run ygg-qa workflow inline

## Stage Responsibility

- `ygg-add` is responsible for implementing the work defined in `tasks.md`, in order.
- During implementation it must stay inside `design.md` and `specs/`, and it must keep `tasks.md` plus the daily change log current.
- This stage ends when the change is ready to be proven by `ygg-qa`, not merely when some code has been written.

## Rules

- Refuse to implement anything not in tasks.md
- Follow specs/ constraints and design.md decisions
- Fix lint/typecheck failures before moving to the next task

## Bug Discovery

When a bug is found: AskUserQuestion: "Fix now + record log" / "Record as separate topic" / "Abort"

## Partial Implementation

Progress saved in tasks.md. Continue where left off on next `/ygg:add` call.
