---
name: ygg-teams
description: >
  Toggle expert review mode and run expert evaluation. Agent team of architecture/UI·UX/data/security/performance
  experts validates design and scores it. All selected experts must score 0.95+ to proceed to implementation.
  Triggered by /ygg:teams command.
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# ygg-teams — Expert Review Mode

Refer to `ygg-core` skill for shared rules and formats.

## Overview

Uses Claude Code agent teams to validate design documents from multiple expert perspectives.
Toggle-based mode that inserts an expert evaluation phase into the existing workflow.

- Enabled: `create → next → **[expert review ⟳ design revision loop]** → add → qa`
- Disabled: `create → next → add → qa`

## Expert Pool (5 types)

| Expert | Agent Definition | Selection Criteria |
|---|---|---|
| 🏗️ Architecture | `expert-architect` | modules, layers, API, dependencies, structural changes |
| 🎨 UI/UX | `expert-uiux` | CLI, interface, commands, output formats |
| 📊 Data | `expert-data` | schema, JSON, data flow, parsing |
| 🔒 Security | `expert-security` | auth, permissions, input validation, file access |
| ⚡ Performance | `expert-performance` | bulk processing, parallelism, caching, token cost |

## Workflow

### 1. Toggle Mode (argument: on/off/none)

**on:**
1. Add `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` to `env` in `.claude/settings.json`
2. Create file if missing, merge into env section if exists
3. Display "✅ Expert review mode enabled"

**off:**
1. Remove `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` from `env` in `.claude/settings.json`
2. Display "❌ Expert review mode disabled"

**No argument:**
1. Check current state, show toggle options via AskUserQuestion

### 2. Expert Review Execution (when chained from ygg-next)

#### Step 1: Confirm active topic
1. Find topic with stage = `next` in `ygg/change/INDEX.md`
2. Read `proposal.md` + `design.md`

#### Step 2: Auto-select experts
1. Analyze proposal.md + design.md content
2. Match against each expert's selection keywords
3. Select relevant experts (minimum 2, maximum 5)
4. Present selection to user via AskUserQuestion:
   ```
   question: "The following experts have been selected. Would you like to make changes?"
   options:
     - "Proceed as is (Recommended)"
     - "Add/remove experts"
   ```

#### Step 3: Create agent team
1. Create agent team with selected experts
2. Each teammate should:
   - Read proposal.md and design.md
   - Optionally explore codebase for context
   - Evaluate design from their expertise perspective
   - Score the design (0.00~1.00) using their Scoring Rubric
   - Report in the specified Output Format

#### Step 4: Collect scores and evaluate
1. Collect each expert's evaluation and score
2. Summarize discussion between experts
3. Decision:
   - **All ≥ 0.95** → PASS
   - **Any < 0.95** → RETRY

#### Step 5: Generate review.md
1. Create `ygg/change/{topic}/review.md` (latest)
2. Preserve history as `ygg/change/{topic}/review-r{N}.md`

#### Step 6: Branch based on result

**PASS:**
```
AskUserQuestion:
  "✅ All experts scored 0.95+. Choose next step."
  - "Start implementation (Recommended)" → chain to /ygg:add
  - "Review review.md before deciding"
```

**RETRY:**
```
AskUserQuestion:
  "❌ Below threshold areas exist. ({list of failing experts})"
  - "Apply revisions — incorporate expert recommendations into design.md (Recommended)"
  - "User override — proceed with current state"
  - "Manual edit and re-evaluate"
```

#### Step 7: Round limit

After 5 rounds:
```
AskUserQuestion:
  "⚠️ Maximum rounds (5) reached."
  - "Proceed with current state (user override)"
  - "Run 1 additional round"
```

## Edge Cases

- **Agent teams not supported**: guide to set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`
- **design.md missing**: guide to run `/ygg:next` first
- **review.md already exists**: ask whether to add new round on top of existing review
- **Agent team creation fails**: report error + retry guidance
