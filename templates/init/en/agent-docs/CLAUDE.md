# Claude Guide

Read `ygg/agent.md` first for the shared workflow.

## Claude-Specific Usage

- `CLAUDE.md` is the Claude harness entrypoint. Treat it as the map for slash commands, hooks, and generated Claude skills.
- Use Claude runtime surfaces only: `CLAUDE.md`, `.claude/commands/`, `.claude/skills/`, and `.claude/settings.json`. Do not treat `AGENTS.md` or `.codex/skills/` as Claude runtime instructions.
- When editing ygg itself, `AGENTS.md` and `.codex/` remain valid repository files to update, but they are output targets rather than Claude operating instructions.
- Work in the sequence `/ygg:create`, `/ygg:next`, `/ygg:add`, `/ygg:qa`, `/ygg:status`, `/ygg:prove`.
- Follow the detailed automation from `.claude/commands/ygg/`, `.claude/skills/`, and `.claude/settings.json`.
- If a hook warns, resolve the scope or documentation mismatch before continuing.
- When `/ygg:qa` succeeds, the topic must be treated as finally complete and moved to archive immediately. Claude workflows must not leave QA-passed topics in the active list.
