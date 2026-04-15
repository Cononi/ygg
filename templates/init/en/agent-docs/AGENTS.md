# Codex Guide

Read `ygg/agent.md` first for the shared workflow.

## Codex-Specific Usage

- Codex does not use `/ygg:*` slash commands, so work directly from the documents under `ygg/change/<topic>/`.
- Before implementation, use `proposal.md`, `design.md`, and `tasks.md` as the source of truth for scope and completion.
- When you need verification, run `bash .claude/scripts/ygg-prove.sh` and the project's normal build/test commands directly.
- If QA passes, the topic is finally complete and must be moved from active into `ygg/change/archive/` immediately. Codex must not leave QA-passed topics in the active list.
