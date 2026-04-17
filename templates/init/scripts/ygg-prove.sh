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
has_claude_layout() { [ -d ".claude" ]; }
has_codex_layout() { [ -d ".codex" ] || [ -f "AGENTS.md" ]; }

section "1. Directories"
check_dir "ygg"
check_dir "ygg/change"
check_dir "ygg/change/archive" warn
if has_claude_layout; then
  for d in .claude .claude/agents .claude/commands/ygg ygg/scripts; do
    check_dir "$d"
  done
else
  warn ".claude layout not present"
fi
if has_codex_layout; then
  check_dir ".codex" warn
  check_dir ".codex/skills" warn
else
  warn ".codex layout not present"
fi

section "2. Agent"
if [ -f ".claude/agents/dev.md" ]; then
  pass "dev.md exists"
  grep -q "^name: dev" .claude/agents/dev.md && pass "has name" || fail "missing name"
  grep -q "^description:" .claude/agents/dev.md && pass "has description" || fail "missing description"
elif [ -f "AGENTS.md" ]; then
  pass "AGENTS.md exists"
  grep -q "Codex Guide" AGENTS.md && pass "AGENTS has codex guide" || warn "AGENTS missing Codex Guide heading"
else
  fail "no supported agent document found"
fi

section "3. Commands"
if has_claude_layout; then
  for cmd in create status next prove add qa lang; do
    check_file ".claude/commands/ygg/${cmd}.md"
  done
else
  warn "Claude commands skipped in Codex-only layout"
fi

section "4. Skills"
if has_claude_layout; then
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
fi
if has_codex_layout; then
  for skill in ygg-core ygg-create ygg-status ygg-next ygg-prove ygg-add ygg-qa; do
    f=".codex/skills/${skill}/SKILL.md"
    if [ -f "$f" ]; then
      pass "codex ${skill} exists"
      grep -q "^name: ${skill}" "$f" && pass "codex ${skill} name" || fail "codex ${skill} missing name"
      grep -q "^description:" "$f" && pass "codex ${skill} description" || fail "codex ${skill} missing description"
      [ "$(grep -c '^## Source Mapping$' "$f")" -le 1 ] && pass "codex ${skill} source mapping deduplicated" || fail "codex ${skill} has duplicated Source Mapping sections"
    else
      fail "codex ${skill} missing"
    fi
  done
  [ ! -d ".codex/skills/ygg-teams" ] && pass "codex excludes Claude-only ygg-teams" || fail "codex should not include ygg-teams"
fi

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
  if has_claude_layout; then
    fail "settings.json missing"
  else
    warn "Claude hooks skipped in Codex-only layout"
  fi
fi

section "6. Scripts"
SCRIPT_BASE=""
if [ -d "ygg/scripts" ]; then
  SCRIPT_BASE="ygg/scripts"
elif [ -d "templates/init/scripts" ]; then
  SCRIPT_BASE="templates/init/scripts"
fi
for script in ygg-scope-check.sh ygg-track-change.sh ygg-progress-check.sh ygg-log-change.sh ygg-prove.sh; do
  f="${SCRIPT_BASE}/${script}"
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
[ ! -f "AGENTS.md" ] || ! grep -q "Follow the detailed automation from \`.claude/commands" "AGENTS.md" && pass "AGENTS avoids Claude runtime instructions" || fail "AGENTS should not point Codex users at Claude runtime automation"
[ ! -f "CLAUDE.md" ] || ! grep -q "Use the generated \`.codex/skills" "CLAUDE.md" && pass "CLAUDE avoids Codex runtime instructions" || fail "CLAUDE should not point Claude users at Codex runtime automation"

section "8. Active Topic"
if [ -f "ygg/change/INDEX.md" ]; then
  ACTIVE=$(
    grep -E "진행중|진행 중" ygg/change/INDEX.md | head -1 \
      | sed -n 's/.*\[\([^]]*\)\](.*/\1/p'
  )
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
if [ -n "$SCRIPT_BASE" ] && [ -f "${SCRIPT_BASE}/ygg-scope-check.sh" ]; then
  CLAUDE_TOOL_INPUT_FILE_PATH="test/outside.ts" bash "${SCRIPT_BASE}/ygg-scope-check.sh" >/dev/null 2>&1
  pass "scope-check runs"
fi
if [ -n "$SCRIPT_BASE" ] && [ -f "${SCRIPT_BASE}/ygg-track-change.sh" ]; then
  rm -f .ygg-changed
  CLAUDE_TOOL_INPUT_FILE_PATH="src/test.ts" bash "${SCRIPT_BASE}/ygg-track-change.sh" 2>/dev/null
  [ -f .ygg-changed ] && grep -q "src/test.ts" .ygg-changed && pass "track-change works" || fail "track-change failed"
  rm -f .ygg-changed
fi
if [ -n "$SCRIPT_BASE" ] && [ -f "${SCRIPT_BASE}/ygg-progress-check.sh" ]; then
  echo "src/test.ts" > .ygg-changed
  PROGRESS_OUTPUT="$(bash "${SCRIPT_BASE}/ygg-progress-check.sh" 2>&1 || true)"
  echo "$PROGRESS_OUTPUT" | grep -q "\[ygg\]" && pass "progress-check works" || fail "progress-check failed"
  rm -f .ygg-changed
fi

section "10. Gitignore"
[ -f ".gitignore" ] && grep -q ".ygg-changed" .gitignore && pass ".ygg-changed ignored" || warn ".ygg-changed not in .gitignore"

echo ""
echo "═══════════════════════════════════"
echo "  Results: ✅ ${PASS} passed | ❌ ${FAIL} failed | ⚠️  ${WARN} warnings"
echo "═══════════════════════════════════"
[ "$FAIL" -gt 0 ] && { echo "  Some checks failed."; exit 1; } || { echo "  All checks passed!"; exit 0; }
