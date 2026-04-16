---
name: ygg-create
description: "Create a new feature/change proposal. Validates spec completeness via YGG Point scoring, asking clarifying questions until clarity reaches 0.95+. Triggered by /ygg:create command."
license: MIT
compatibility: Requires Codex CLI project skills.
metadata:
  author: ygg
  sourceLang: "en"
  generatedBy: "@cono-ai/ygg"
---

Create a new feature/change proposal. Validates spec completeness via YGG Point scoring, asking clarifying questions until clarity reaches 0.95+. Triggered by /ygg:create command.

**Input**: Accept the user request normally. If required context is missing, ask for it before proceeding.

## Source Mapping

- Claude command source: `/ygg:create`
- Claude skill source: `ygg-create`
- Codex behavior: perform the same workflow directly in this repository without relying on Claude-only slash commands or AskUserQuestion primitives.
- When a Claude step says `AskUserQuestion`, preserve the same interaction contract in Codex: choice prompts must stay interactive with arrow-key selection in terminal flows, while open-ended clarification can continue in plain chat.

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

0. **Local LLM check** — `Bash: ygg llm status --json`. If `active !== null`, delegate scoring (step 3) via `ygg llm score --dimensions <dims.json> --input <topic.md>` and proposal synthesis (step 6) via `ygg llm write --type proposal --input <context.json>`. On non-zero exit report and stop — see ygg-core Local LLM Delegation section.
1. **Check arguments** — if none, request description via AskUserQuestion
2. **Auto-mode selection** — if `ygg point auto-mode` is unset, present a mandatory interactive `on/off` choice with arrow-key selection in terminal flows. This setting applies to `create` only
3. **Round 0** — calculate baseFill and inspect reference/consistency candidates. Auto-verify them only when `ygg point auto-mode=on`; when `off`, keep them in the user question flow → show score
4. **Interactive Question Loop** — ask exactly one question at a time. Never dump multiple questions together. Do not repeat the same question. Continue until the proposal reaches 0.95+ clarity or no better clarification question remains
5. **Create directory** — `ygg/change/{topic-name}/`
6. **Generate proposal.md** — synthesize Q&A results in ygg-core's proposal format. These questions are the critical source for later design quality
7. **Save ygg-point.json** — write the author's original request text at the top level, then keep only the stage summary and per-dimension question/answer trails needed to explain score changes; each trail entry must keep the globally increasing `round`
8. **Update INDEX.md** — register new topic (🔄 in progress, create)
9. **Next Steps** — AskUserQuestion as a mandatory interactive choice: "Continue to design (Recommended)" / "Edit proposal" / "Cancel"
10. **Auto-chain** — if "Continue to design" selected, immediately run ygg-next workflow inline

## Stage Responsibility

- `ygg-create` is the entry point for the full workflow. Its job is to create the topic and prepare a clean handoff to `ygg-next`.
- The chain then relies on `ygg-next` to define design/spec/tasks, `ygg-add` to implement, and `ygg-qa` to verify and finalize.
- The workflow is not complete until `ygg-qa` passes and the topic is moved into `ygg/change/archive/`.

## Edge Cases

- **Topic exists**: overwrite / use different name / Cancel
- **ygg/ missing**: auto-create
- **Low-scoring topic**: keep clarifying with one question per round until the proposal becomes precise enough, rather than enforcing a fixed minimum count
- **Detailed initial input**: fewer rounds are expected when the request is already specific
