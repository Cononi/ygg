---
name: ygg-next
description: "Build design, spec, and tasks for the active proposal. Validates architecture decisions via YGG Point scoring. Triggered by /ygg:next command."
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# ygg-next — Design + Spec + Tasks with YGG Point

Refer to `ygg-core` for shared rules, formats, and YGG Point system.

## Scoring Dimensions (next stage — design focus)

| Dimension | Weight | Measures |
|-----------|--------|----------|
| architecture | 0.25 | Implementation structure/patterns |
| tradeoff | 0.25 | Pros/cons of choices |
| constraint | 0.20 | Technical/non-functional constraints |
| dependency | 0.15 | Implementation order, module dependencies |
| rollback | 0.15 | Rollback feasibility |

## Workflow

0. **Local LLM check** — `Bash: ygg llm status --json`. If `active !== null`, delegate scoring (step 4) via `ygg llm score`, and design/specs/tasks synthesis (steps 6–8) via `ygg llm write --type design|spec|tasks`. On non-zero exit report and stop — see ygg-core Local LLM Delegation section.
1. **Find active topic** — locate stage=`create` topic in INDEX.md (see ygg-core)
2. **Read proposal.md + ygg-point.json** — use create stage score trails to avoid duplicate questions and preserve why scores changed
3. **Analyze codebase** — source related to Impact, architecture, dependencies, tests, git log
4. **Round 0** — calculate baseFill from proposal + code analysis, and inspect reference/consistency candidates. Auto-verify them only when `ygg point auto-mode=on`; when `off`, keep them in the user question flow → show score
5. **Question Loop** — if `ygg point auto-mode=off`, first require at least 5 user-answered questions for every dimension before generating design/spec/tasks. All choices must be presented as numbered options and, in terminal mode, be selectable by number keys or arrow keys. After the minimum is satisfied, continue the normal threshold loop and ask whether to continue beyond the default 5 rounds
6. **Generate design.md** — synthesize Q&A + proposal + code analysis in ygg-core's design format
7. **Generate specs/** — per-component spec.md (ygg-core format)
8. **Generate tasks.md** — checklist based on Migration Plan order in design (ygg-core format)
9. **Update ygg-point.json** — add next stage summary and dimension score trails while preserving the top-level original request text
10. **Update INDEX.md** — change stage to `next`
11. **Summary + Next** — AskUserQuestion: "Start implementation (Recommended)" / "Edit design/spec/tasks" / "Cancel"
12. **Auto-chain** — if "Start implementation" selected, immediately run ygg-add workflow inline

## Stage Responsibility

- `ygg-next` turns the proposal into an implementation-ready plan.
- Its required outputs are `design.md`, `specs/`, and `tasks.md`, and those documents become the source of truth for `ygg-add`.
- This stage does not finish the implementation; it locks down the order, constraints, and acceptance shape for implementation.

## Edge Cases

- **No topic found**: guide to `/ygg:create`
- **design.md already exists**: overwrite / edit / Cancel
- **Insufficient proposal**: run abbreviated create scoring
- **Large scope**: generate multiple specs + detailed task breakdown
