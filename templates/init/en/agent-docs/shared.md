# YGG Agent Workflow

This project manages work per change under `ygg/change/`.

## Shared Rules

1. Before making changes, read `ygg/change/INDEX.md` and the active topic's `proposal.md`, `design.md`, and `tasks.md`.
2. Keep implementation inside the scope defined by `tasks.md`; call out scope expansion before doing it.
3. After changes, run the relevant verification steps such as build, tests, lint, and typecheck.
4. Record decisions and verification evidence back into the active topic documents.
5. Prefer small, reviewable changes and follow the surrounding code style and structure.
6. If QA passes, the active topic is considered finally complete and must be moved to `ygg/change/archive/` immediately. Leaving a QA-passed topic in the active list is not allowed for any AI workflow.

## Standard Flow

1. Define intent and scope in `proposal.md`
2. Finalize design and requirements in `design.md` and `specs/`
3. Implement in the order defined by `tasks.md`
4. Run QA and record verification results
5. On QA success, complete the topic and archive it immediately

## Stage Roles

1. `ygg-create` creates the proposal and starts the workflow.
2. `ygg-next` defines design/spec/tasks and locks the implementation plan.
3. `ygg-add` implements the tasks in order and records the change log.
4. `ygg-qa` proves the result with real verification and, on success, completes and archives the topic.

## Key Paths

- Change index: `ygg/change/INDEX.md`
- Active topic: `ygg/change/<topic>/`
- Verification script: `bash ygg/scripts/ygg-prove.sh`

If `.claude/` exists, keep using the Claude slash commands, skills, and hooks from that directory.
