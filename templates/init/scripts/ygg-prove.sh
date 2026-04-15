#!/usr/bin/env bash
# ygg-prove.sh — Verify all ygg components are installed and working
# Exit: 0 = all pass, 1 = failures

set -uo pipefail

PASS=0 FAIL=0 WARN=0
pass() { PASS=$((PASS+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
warn() { WARN=$((WARN+1)); echo "  ⚠️  $1"; }
section() { echo ""; echo "━━━ $1 ━━━"; }
check_dir() { [ -d "$1" ] && pass "$1 exists" || ${2:-fail} "$1 missing"; }
check_file() { [ -f "$1" ] && pass "$1 exists" || ${2:-fail} "$1 missing"; }

section "1. Directories"
for d in .claude .claude/agents .claude/commands/ygg .claude/scripts ygg ygg/change; do
  check_dir "$d"
done
check_dir "ygg/change/archive" warn

section "2. Agent"
if [ -f ".claude/agents/dev.md" ]; then
  pass "dev.md exists"
  grep -q "^name: dev" .claude/agents/dev.md && pass "has name" || fail "missing name"
  grep -q "^description:" .claude/agents/dev.md && pass "has description" || fail "missing description"
else
  fail "dev.md missing"
fi

section "3. Commands"
for cmd in create status next prove add qa lang; do
  check_file ".claude/commands/ygg/${cmd}.md"
done

section "4. Skills"
for skill in ygg-core ygg-create ygg-status ygg-next ygg-prove ygg-add ygg-qa ygg-lang; do
  f=".claude/skills/${skill}/SKILL.md"
  if [ -f "$f" ]; then
    pass "${skill} exists"
    grep -q "^name: ${skill}" "$f" && pass "${skill} name" || fail "${skill} missing name"
    grep -q "allowed_tools:" "$f" && pass "${skill} tools" || fail "${skill} missing tools"
  else
    fail "${skill} missing"
  fi
done

section "5. Hooks"
if [ -f ".claude/settings.json" ]; then
  pass "settings.json exists"
  if python3 -c "import json; json.load(open('.claude/settings.json'))" 2>/dev/null || \
     node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))" 2>/dev/null; then
    pass "valid JSON"
  else
    fail "invalid JSON"
  fi
  for hook in hooks PreToolUse PostToolUse Stop; do
    grep -q "\"${hook}\"" .claude/settings.json && pass "${hook} configured" || fail "${hook} missing"
  done
else
  fail "settings.json missing"
fi

section "6. Scripts"
for script in ygg-scope-check.sh ygg-track-change.sh ygg-progress-check.sh ygg-log-change.sh ygg-prove.sh; do
  f=".claude/scripts/${script}"
  if [ -f "$f" ]; then
    pass "${script} exists"
    [ -x "$f" ] && pass "executable" || fail "not executable (chmod +x $f)"
    bash -n "$f" 2>/dev/null && pass "valid syntax" || fail "syntax errors"
  else
    fail "${script} missing"
  fi
done

section "7. Documents"
check_file "ygg/change/INDEX.md" warn
[ -f "ygg/change/INDEX.md" ] && grep -q "토픽" ygg/change/INDEX.md && pass "INDEX has topic table" || true

section "8. Active Topic"
if [ -f "ygg/change/INDEX.md" ]; then
  ACTIVE=$(grep "진행중" ygg/change/INDEX.md | head -1 | sed 's/|//g' | awk '{print $1}' | xargs)
  if [ -n "$ACTIVE" ] && [ -d "ygg/change/${ACTIVE}" ]; then
    pass "topic '${ACTIVE}' exists"
    check_file "ygg/change/${ACTIVE}/proposal.md" warn
  else
    warn "No active topic"
  fi
else
  warn "No INDEX.md — skip"
fi

section "9. Integration"
if [ -f ".claude/scripts/ygg-scope-check.sh" ]; then
  CLAUDE_TOOL_INPUT_FILE_PATH="test/outside.ts" bash .claude/scripts/ygg-scope-check.sh >/dev/null 2>&1
  pass "scope-check runs"
fi
if [ -f ".claude/scripts/ygg-track-change.sh" ]; then
  rm -f .ygg-changed
  CLAUDE_TOOL_INPUT_FILE_PATH="src/test.ts" bash .claude/scripts/ygg-track-change.sh 2>/dev/null
  [ -f .ygg-changed ] && grep -q "src/test.ts" .ygg-changed && pass "track-change works" || fail "track-change failed"
  rm -f .ygg-changed
fi
if [ -f ".claude/scripts/ygg-progress-check.sh" ]; then
  echo "src/test.ts" > .ygg-changed
  bash .claude/scripts/ygg-progress-check.sh 2>&1 | grep -q "\[ygg\]" && pass "progress-check works" || fail "progress-check failed"
  rm -f .ygg-changed
fi

section "10. Gitignore"
[ -f ".gitignore" ] && grep -q ".ygg-changed" .gitignore && pass ".ygg-changed ignored" || warn ".ygg-changed not in .gitignore"

echo ""
echo "═══════════════════════════════════"
echo "  Results: ✅ ${PASS} passed | ❌ ${FAIL} failed | ⚠️  ${WARN} warnings"
echo "═══════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "  Some checks failed."; exit 1; } || { echo "  All checks passed!"; exit 0; }
