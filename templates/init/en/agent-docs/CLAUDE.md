# Claude Guide

Read `ygg/agent.md` first for the shared workflow.

## Claude-Specific Usage

- Work in the sequence `/ygg:create`, `/ygg:next`, `/ygg:add`, `/ygg:qa`, `/ygg:status`, `/ygg:prove`.
- Follow the detailed automation from `.claude/commands/ygg/`, `.claude/skills/`, and `.claude/settings.json`.
- If a hook warns, resolve the scope or documentation mismatch before continuing.
- When `/ygg:qa` succeeds, the topic must be treated as finally complete and moved to archive immediately. Claude workflows must not leave QA-passed topics in the active list.
