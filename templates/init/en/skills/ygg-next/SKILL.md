---
name: ygg-next
description: "Build design, spec, and tasks for the active proposal. Validates architecture decisions via YGG Point scoring. Triggered by /ygg:next command."
license: MIT
compatibility: Requires Codex CLI project skills.
metadata:
  author: ygg
  sourceLang: "en"
  generatedBy: "@cono-ai/ygg"
---

Build design, spec, and tasks for the active proposal. Validates architecture decisions via YGG Point scoring. Triggered by /ygg:next command.

**Input**: Accept the user request normally. If required context is missing, ask for it before proceeding.

## Source Mapping

- Claude command source: `/ygg:next`
- Claude skill source: `ygg-next`
- Codex behavior: perform the same workflow directly in this repository without relying on Claude-only slash commands or AskUserQuestion primitives.
- When a Claude step says `AskUserQuestion`, ask the user directly in plain chat and continue from the answer.

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

0. **Local LLM check** — `Bash: ygg llm status --json`. If `active !== null`, delegate synthesis (steps 5–7) via `ygg llm write --type design|spec|tasks`. On non-zero exit report and stop — see ygg-core Local LLM Delegation section.
1. **Find active topic** — locate stage=`create` topic in INDEX.md (see ygg-core)
2. **Read proposal.md + ygg-point.json** — use create stage score trails and original request text as the source of truth
3. **Analyze codebase** — source related to Impact, architecture, dependencies, tests, git log
4. **No new question loop** — `ygg-next` must not ask the user new questions. It must synthesize from `proposal.md`, the top-level original request, and the accumulated `create` trails
5. **Generate design.md** — synthesize create-stage evidence + proposal + code analysis in ygg-core's design format
6. **Generate specs/** — per-component spec.md (ygg-core format)
7. **Generate tasks.md** — checklist based on Migration Plan order in design (ygg-core format)
8. **Update ygg-point.json** — add next stage summary while preserving the top-level original request text and existing create trails
9. **Update INDEX.md** — change stage to `next`
10. **Summary + Next** — AskUserQuestion: "Start implementation (Recommended)" / "Edit design/spec/tasks" / "Cancel"
11. **Auto-chain** — if "Start implementation" selected, immediately run ygg-add workflow inline

## Stage Responsibility

- `ygg-next` turns the proposal into an implementation-ready plan.
- Its required outputs are `design.md`, `specs/`, and `tasks.md`, and those documents become the source of truth for `ygg-add`.
- This stage does not finish the implementation; it locks down the order, constraints, and acceptance shape for implementation.

## Edge Cases

- **No topic found**: guide to `/ygg:create`
- **design.md already exists**: overwrite / edit / Cancel
- **Insufficient proposal**: synthesize conservatively from the available create trails
- **Large scope**: generate multiple specs + detailed task breakdown
