# Codex Guide

Read `ygg/agent.md` first for the shared workflow.

## Codex-Specific Usage

- `AGENTS.md` is the Codex harness entrypoint. Treat it as an index into the repository, not as the full procedure dump.
- Use Codex runtime surfaces only: `AGENTS.md` and `.codex/skills/`. Do not follow `.claude/commands` or Claude-only hook instructions as runtime guidance.
- When editing ygg itself, `.claude/` files are still valid source files to modify, but they are implementation targets, not Codex operating instructions.
- Codex does not use `/ygg:*` slash commands, so work directly from the documents under `ygg/change/<topic>/`.
- Before implementation, use `proposal.md`, `design.md`, and `tasks.md` as the source of truth for scope and completion.
- When you need verification, run the shared verification script `bash ygg/scripts/ygg-prove.sh` and the project's normal build/test commands directly.
- If QA passes, the topic is finally complete and must be moved from active into `ygg/change/archive/` immediately. Codex must not leave QA-passed topics in the active list.
