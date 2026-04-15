---
name: ygg-prove
description: "Verify entire ygg system installation. Tests directory structure, agents, commands, skills, hooks, scripts. Triggered by /ygg:prove command."
allowed_tools:
  - Read
  - Bash
  - Glob
---

# ygg-prove — System Verification

1. Run `bash .claude/scripts/ygg-prove.sh`
2. Display full test report
3. Failures: explain each + fix commands
4. All pass: confirm ready + list available `/ygg:*` commands

Tests: directories, agent, commands, skills, hooks, scripts, documents, changes, integration, gitignore.
