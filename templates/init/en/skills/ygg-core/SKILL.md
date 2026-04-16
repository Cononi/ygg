---
name: ygg-core
description: "Shared rules and formats for all /ygg:* commands. Defines the OpenSpec-like pipeline (create→next→add→qa), per-change directory structure under ygg/change/, document formats, and AskUserQuestion interaction rules. Auto-activates alongside any ygg skill."
allowed_tools:
  - Read
  - AskUserQuestion
---

# ygg-core — Shared Rules

All `/ygg:*` commands follow these rules.

## Pipeline

```
create <description> → proposal.md
next                 → design.md + specs/ + tasks.md
add                  → implementation
qa                   → build/test/verification
done                 → mark complete + move to archive
```

Each stage auto-chains to next on user approval. Cancel stops the chain.

## Stage Roles

| Stage | Skill | Responsibility | Exit Condition |
|------|-------|----------------|----------------|
| create | ygg-create | Define intent and scope in proposal form and start the chain | proposal.md + ygg-point.json + INDEX create |
| next | ygg-next | Turn the proposal into an implementation-ready design/spec/task plan | design.md + specs/ + tasks.md + INDEX next |
| add | ygg-add | Implement tasks in order and keep the change log current | code changes + task progress + INDEX add |
| qa | ygg-qa | Prove the result with build/test/lint/typecheck and spec cross-check evidence | all checks pass + completion + archive move |

The workflow starts at `ygg-create`, must proceed through `ygg-next → ygg-add → ygg-qa` in order, and is only finished after completion handling and archive move.

## Directory Structure

```
ygg/change/
├── INDEX.md                 ← topic list + status
├── {topic}/
│   ├── proposal.md          ← create
│   ├── design.md            ← next
│   ├── specs/{component}/spec.md ← next
│   ├── tasks.md             ← next
│   ├── ygg-point.json       ← stage-local score trails with linked Q&A
│   └── YYYY-MM-DD.md        ← add (daily change log)
└── archive/                 ← moved here after qa passes
```

## YGG Point Scoring

Score-based question loop. Generates documents when 0.95+ is reached.

**Calculation**: `dimension_score = baseFill × 0.3 + qualityScore × 0.7`, `total = Σ(score × weight)`

**Evaluators** (4 per dimension):
- **humanistic/domain**: requires user answers
- **reference/consistency**: auto-verified from code/documents

**Loop**: ask 1–3 questions about the lowest-scoring dimension → incorporate answers → recalculate → repeat.
In `ygg-create` and `ygg-next`, auto-verifiable `reference` / `consistency` evaluators must follow `ygg point auto-mode`: answer them internally first only when it is `on`, and keep them in the user-driven clarification flow when it is `off`.
When `ygg point auto-mode` is `off`, `create` and `next` must collect at least 5 user-answered questions for every dimension before finalizing the stage, even if the score reaches 0.95 earlier.
After that minimum is satisfied, if the stage is still below the threshold, ask whether to continue raising selected dimensions with additional rounds or finalize as-is.
Every saved answer must stay linked to its dimension, evaluator, answer source, score-before, and score-after values inside the owning dimension trail so Topic Detail can explain how each score moved. `questionTrail.round` must restart at `1` inside each dimension and show that dimension's step-by-step score lift.
Continue the loop until the stage reaches 0.95+ readiness.

## Document Formats

### proposal.md
`Why` → `What Changes` → `Capabilities` (New/Modified) → `Impact` (files, scope) → `Boundary` (Non-Goals)

### design.md
`Context` → `Goals/Non-Goals` → `Decisions` (decision/rationale/alternatives) → `Constraints` → `Risks/Trade-offs` → `Migration Plan` → `Open Questions`

### specs/{component}/spec.md
`Requirements` (checklist) → `Constraints` → `Interface`

### tasks.md
Numbered step-by-step `- [ ]` checklist. Last step is always "verification".

### INDEX.md
`| Topic | Status | Stage | Last Date |` table + Archive section.
Status: 🔄 in progress / ✅ complete. Stage: create → next → add → qa.

### ygg-point.json
Do not generate a duplicated top-level `history` block. Keep the question/answer trace only inside each dimension's `questionTrail`.
Prefer a lean schema: keep top-level original request text plus score/status metadata, stage-local `initialScore`, `finalScore`, `delta`, and the per-dimension `questionTrail` details needed to explain score movement. Remove duplicated or unused fields.

## Active Topic Detection

1. Read `ygg/change/INDEX.md`
2. Find the topic in 🔄 in-progress status matching the required stage (most recent if multiple)
3. If none found, guide to the appropriate command

## Rules

1. Follow pipeline order
2. `/ygg:create` does not read existing context (fresh start)
3. Scope guard — only implement what's in the proposal
4. Follow spec constraints
5. Update tasks.md immediately
6. Always use AskUserQuestion — never auto-select
7. Every user choice must be shown as a numbered option list, and terminal flows must also support arrow-key selection
8. Mark recommended options with `(Recommended)`, always include Cancel/Skip
9. Do not use deprecated APIs — migrate to latest alternatives
10. Keep all ygg/ documents under 200 lines

## Reading Rules

| Command | Reads | Does NOT read |
|---------|-------|---------------|
| create | **Nothing** | change |
| next | proposal.md, ygg-point.json | other topics |
| add | design.md, specs/, tasks.md | other topics |
| qa | tasks.md, specs/, design.md | archive |
| status | change/INDEX.md | individual files |

## Local LLM Delegation (LM Studio)

When `llm.active` is not null (set by `ygg llm`), the `ygg:add` stage can delegate code generation to LM Studio to save primary-model tokens.

**Check first** — `ygg:add` runs `Bash: ygg llm status --json` as its step 0. If `active === null`, skip delegation and implement directly.

**Delegation Matrix**:

| Work | When enabled | When disabled |
|------|--------------|---------------|
| `ygg:add` code draft generation | `ygg llm code --context <file> --task <desc>` → stdout | Primary AI |
| `ygg:add` file apply (Write/Edit) | Primary AI | Primary AI |
| code reading (Read/Grep/Glob) | Primary AI | Primary AI |
| create/next/qa document synthesis | Primary AI | Primary AI |

**Never delegate**: create/next/qa stages, document synthesis, design decisions — all stay on the primary AI.

**Failure handling**: if `ygg llm code` exits non-zero (2=disabled, 8=timeout, 10=context not found, 12=adapter error), fall back to writing code directly and log the reason.
