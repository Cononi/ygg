---
name: ygg-prove
description: "ygg 시스템 전체 검증. 디렉토리 구조, agents, commands, skills, hooks, scripts 설치 상태를 테스트. /ygg:prove 커맨드로 실행."
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
