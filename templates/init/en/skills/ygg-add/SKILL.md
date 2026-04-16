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
4. **Choose implementation mode** — AskUserQuestion: "Implement all (Recommended)" / "Auto-complete document-backed tasks" / "Stop"
5. **Implement per task** — for each open checklist item, try repository-specific implementation first; if not available, auto-complete only tasks that can be proven from existing artifacts
6. **Built-in auto completion** — mark tasks complete when the required artifact already exists, such as `design.md`, `specs/spec-core/spec.md`, `tasks.md`, `ygg-point.json` next snapshot, `INDEX.md` stage transition, or the daily log itself
7. **Change log** — `ygg/change/{topic}/{YYYY-MM-DD}.md`: Why, Spec, Completed, Pending
8. **Update INDEX.md** — change stage to `add` on first implementation
9. **After completion** — AskUserQuestion: "Start verification (Recommended)" / "Continue implementing" / "Stop"
10. **Auto-chain** — if "Start verification" selected, immediately run ygg-qa workflow inline

## Stage Responsibility

- `ygg-add` is responsible for implementing the work defined in `tasks.md`, in order.
- During implementation it must stay inside `design.md` and `specs/`, and it must keep `tasks.md` plus the daily change log current.
- This stage ends when the change is ready to be proven by `ygg-qa`, not merely when some code has been written.
- The generic CLI may only auto-complete tasks it can verify from artifacts. Repository-specific code changes require the repository implementation hook or the primary AI to perform the edits.

## Rules

- Refuse to implement anything not in tasks.md
- Follow specs/ constraints and design.md decisions
- Fix lint/typecheck failures before moving to the next task

## Bug Discovery

When a bug is found: AskUserQuestion: "Fix now + record log" / "Record as separate topic" / "Abort"

## Partial Implementation

Progress saved in tasks.md. Continue where left off on next `/ygg:add` call.
