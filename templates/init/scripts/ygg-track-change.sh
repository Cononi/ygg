#!/usr/bin/env bash
# ygg-track-change.sh
# Hook: PostToolUse (Write|Edit) — 파일 변경을 추적
#
# 동작:
#   Write/Edit 도구 실행 후 변경된 파일 경로를 .ygg-changed에 기록
#   Stop hook (ygg-progress-check.sh)이 이 파일을 읽어 ygg/change/ 갱신 여부 판단
#
# 환경변수 (Claude Code가 자동 주입):
#   CLAUDE_TOOL_NAME — 실행된 도구 이름
#   CLAUDE_TOOL_INPUT_FILE_PATH — 도구가 조작한 파일 경로

set -euo pipefail

TRACKER=".ygg-changed"

# 파일 경로가 있으면 추적 파일에 추가
if [ -n "${CLAUDE_TOOL_INPUT_FILE_PATH:-}" ]; then
  echo "$CLAUDE_TOOL_INPUT_FILE_PATH" >> "$TRACKER"
fi
