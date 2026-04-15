# Codex Guide

Read `ygg/agent.md` first for the shared workflow.

## Codex-Specific Usage

- Codex does not use `/ygg:*` slash commands, so work directly from the documents under `ygg/change/<topic>/`.
- Before implementation, use `proposal.md`, `design.md`, and `tasks.md` as the source of truth for scope and completion.
- When you need verification, run `bash .claude/scripts/ygg-prove.sh` and the project's normal build/test commands directly.
- If QA passes, the topic is finally complete and must be moved from active into `ygg/change/archive/` immediately. Codex must not leave QA-passed topics in the active list.

## Codex Skills

Use the generated `.codex/skills/ygg-*` files as the primary Codex workflow surface. Those files are derived from `templates/init` and contain the operational instructions for each ygg stage.

### Available Skills
- `ygg-add`: Implement tasks from the active change plan in order, following spec constraints. Records daily changes. Triggered by /ygg:add command.
- `ygg-core`: Shared rules and formats for all /ygg:* commands. Defines the OpenSpec-like pipeline (create→next→add→qa), per-change directory structure under ygg/change/, document formats, and AskUserQuestion interaction rules. Auto-activates alongside any ygg skill.
- `ygg-create`: Create a new feature/change proposal. Validates spec completeness via YGG Point scoring, asking clarifying questions until clarity reaches 0.95+. Triggered by /ygg:create command.
- `ygg-next`: Build design, spec, and tasks for the active proposal. Validates architecture decisions via YGG Point scoring. Triggered by /ygg:next command.
- `ygg-prove`: Verify entire ygg system installation. Tests directory structure, agents, commands, skills, hooks, scripts. Triggered by /ygg:prove command.
- `ygg-qa`: Verify implementation. Run build/test/lint/typecheck and cross-check spec requirements with evidence-based pass/fail report. Triggered by /ygg:qa command.
- `ygg-status`: Show implementation progress dashboard. Reads `ygg/change/INDEX.md` and active topics' `tasks.md` files to display per-phase and overall completion rates. Triggered by /ygg:status command.
- `ygg-teams`: >

## Supporting Roles

The Codex skills already embed the important review-role material below. Use this section when you need deeper context for design review or manual validation.

### Agents And Sub-Agent Roles
#### dev

Development assistant that follows project plan and spec under ygg/. Use for implementing features, fixing bugs, and code review within the project's defined architecture.

#### expert-architect (model: sonnet)

Architecture Expert — ygg:teams agent team member. Validates scalability, pattern fit, module separation, and dependency structure of technical designs.

Use this role as a review checklist:
- **Scalability** — Can the design flexibly accommodate future requirement changes?
- **Pattern fit** — Is the chosen design pattern appropriate for the problem?
- **Module separation** — Are concerns properly separated?
- **Dependency structure** — Are dependency directions correct?

#### expert-data (model: sonnet)

Data Expert — ygg:teams agent team member. Validates schema design, data flow, consistency, and data validation.

Use this role as a review checklist:
- **Schema design** — Is the data structure clear and normalized?
- **Data flow** — Is the data transformation from input to output traceable?
- **Validation** — Is input data properly validated?
- **Consistency** — Are data formats consistent throughout the system?

#### expert-performance (model: sonnet)

Performance Expert — ygg:teams agent team member. Validates bottleneck analysis, resource efficiency, and optimization opportunities.

Use this role as a review checklist:
- **Bottlenecks** — Are there obvious performance bottlenecks?
- **Resource efficiency** — Are memory/CPU/I/O used efficiently?
- **Token cost** — Is LLM token usage optimized?
- **Scalability** — Will performance degrade as data/users grow?

#### expert-security (model: sonnet)

Security Expert — ygg:teams agent team member. Validates vulnerability analysis, authentication/authorization, OWASP compliance, and input validation.

Use this role as a review checklist:
- **Input validation** — Is external input properly validated/sanitized?
- **Authentication/authorization** — Is access control correctly designed?
- **File access** — Are there risks such as path traversal?
- **Environment variables/secrets** — Is sensitive information managed securely?

#### expert-uiux (model: sonnet)

UI/UX Expert — ygg:teams agent team member. Validates DX, interface intuitiveness, and error message quality.

Use this role as a review checklist:
- **DX** — Is it easy and intuitive for developers to use?
- **Consistency** — Is it consistent with existing commands/interfaces?
- **Error handling** — Are error messages clear and do they guide toward resolution?
- **Learning curve** — Can a developer new to the tool understand it easily?


## Guardrails

These scripts remain the source of truth for verification and workflow checks. Run them manually from Codex when the current skill calls for verification.

### Scripts And Guardrails
- `ygg-log-change.sh`: ygg-log-change.sh
- `ygg-progress-check.sh`: ygg-progress-check.sh
- `ygg-prove.sh`: ygg-prove.sh — Verify all ygg components are installed and working
- `ygg-scope-check.sh`: ygg-scope-check.sh
- `ygg-track-change.sh`: ygg-track-change.sh

## Usage Pattern

- Start with `ygg/agent.md` and the active topic documents under `ygg/change/<topic>/`.
- Use `.codex/skills/ygg-create/SKILL.md`, `.codex/skills/ygg-next/SKILL.md`, `.codex/skills/ygg-add/SKILL.md`, `.codex/skills/ygg-qa/SKILL.md`, and related files as the stage-by-stage playbooks.
- Treat `AGENTS.md` as the overview, not the full procedure dump.
- Run project tests plus any relevant ygg guardrail scripts yourself when the skill calls for verification.
