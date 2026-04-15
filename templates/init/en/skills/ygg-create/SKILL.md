---
name: ygg-create
description: "Create a new feature/change proposal. Validates spec completeness via YGG Point scoring, asking clarifying questions until clarity reaches 0.95+. Triggered by /ygg:create command."
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# ygg-create — New Proposal with YGG Point

Refer to `ygg-core` for shared rules, formats, and YGG Point system.

## Rule: Fresh Start

**DO NOT read** existing ygg/ documents. Only read project source if needed for context.

## Scoring Dimensions (create stage)

| Dimension | Weight | Measures |
|-----------|--------|----------|
| motivation | 0.25 | Why is this change needed |
| scope | 0.25 | Scope and target of change |
| user-story | 0.20 | Who uses it and how |
| boundary | 0.15 | What will NOT be done (Non-Goals) |
| impact | 0.15 | Affected files/modules |

## Workflow

0. **Local LLM check** — `Bash: ygg llm status --json`. If `active !== null`, delegate scoring (step 2) via `ygg llm score --dimensions <dims.json> --input <topic.md>` and proposal synthesis (step 5) via `ygg llm write --type proposal --input <context.json>`. On non-zero exit report and stop — see ygg-core Local LLM Delegation section.
1. **Check arguments** — if none, request description via AskUserQuestion
2. **Round 0** — calculate baseFill + auto-verify reference/consistency (CLAUDE.md, package.json, git log) → show score
3. **Question Loop** — if < 0.95, run YGG Point loop from ygg-core
4. **Create directory** — `ygg/change/{topic-name}/`
5. **Generate proposal.md** — synthesize Q&A results in ygg-core's proposal format
6. **Save ygg-point.json** — stage, score, breakdown, history
7. **Update INDEX.md** — register new topic (🔄 in progress, create)
8. **Next Steps** — AskUserQuestion: "Continue to design (Recommended)" / "Edit proposal" / "Cancel"
9. **Auto-chain** — if "Continue to design" selected, immediately run ygg-next workflow inline

## Stage Responsibility

- `ygg-create` is the entry point for the full workflow. Its job is to create the topic and prepare a clean handoff to `ygg-next`.
- The chain then relies on `ygg-next` to define design/spec/tasks, `ygg-add` to implement, and `ygg-qa` to verify and finalize.
- The workflow is not complete until `ygg-qa` passes and the topic is moved into `ygg/change/archive/`.

## Edge Cases

- **Topic exists**: overwrite / use different name / Cancel
- **ygg/ missing**: auto-create
- **5 rounds without threshold**: offer option to proceed with current score
- **Detailed initial input**: fewer questions if baseFill is high (minimum 1 round)
