#!/usr/bin/env bash
# ygg-scope-check.sh
# Hook: PreToolUse (Write|Edit) — 활성 토픽의 tasks.md 범위 밖 변경 시 경고
#
# 동작:
#   Write/Edit 실행 전, 변경 대상 파일이 활성 토픽의 tasks.md에 정의된 폴더에 속하는지 확인
#   범위 밖이면 stdout에 경고 출력 (Claude에게 피드백, 차단하지는 않음)
#   활성 토픽이 없거나 tasks.md가 없으면 체크를 건너뜀
#
# 환경변수:
#   CLAUDE_TOOL_INPUT_FILE_PATH — 도구가 조작할 파일 경로
#
# 주의: exit 0 = 허용, exit 2 = 차단. 여기서는 경고만 하고 허용(exit 0)

set -euo pipefail

INDEX="ygg/change/INDEX.md"

# INDEX.md가 없으면 체크 건너뜀
if [ ! -f "$INDEX" ]; then
  exit 0
fi

FILE_PATH="${CLAUDE_TOOL_INPUT_FILE_PATH:-}"

# 파일 경로가 없으면 건너뜀
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 관리 문서는 항상 허용
case "$FILE_PATH" in
  ygg/*|.claude/*|specs/*|.ygg-*)
    exit 0
    ;;
esac

# 활성 토픽 찾기 (진행중 상태)
ACTIVE_TOPIC=$(grep "진행중" "$INDEX" | head -1 | sed 's/|//g' | awk '{print $1}' | sed 's/\[//;s/\]//' | xargs)

if [ -z "$ACTIVE_TOPIC" ]; then
  exit 0
fi

TASKS="ygg/change/${ACTIVE_TOPIC}/tasks.md"

# tasks.md가 없으면 체크 건너뜀
if [ ! -f "$TASKS" ]; then
  exit 0
fi

# tasks.md에서 파일/폴더 경로 추출 (backtick 안의 경로)
TASK_PATHS=$(grep -oP '`[^`]+\.(ts|js|sh|md|yml|yaml|json)`|`[^`]+/`' "$TASKS" 2>/dev/null | tr -d '`' || true)

# 경로 목록이 비어있으면 체크 건너뜀
if [ -z "$TASK_PATHS" ]; then
  exit 0
fi

# 변경 파일이 tasks.md에 정의된 경로에 속하는지 확인
IN_SCOPE=false
while IFS= read -r path; do
  if echo "$FILE_PATH" | grep -q "^${path}\|/${path}"; then
    IN_SCOPE=true
    break
  fi
done <<< "$TASK_PATHS"

if [ "$IN_SCOPE" = false ]; then
  echo ""
  echo "[ygg] Warning: '$FILE_PATH' is outside paths defined in active topic '${ACTIVE_TOPIC}'."
  echo "[ygg] If this is intentional, consider updating ygg/change/${ACTIVE_TOPIC}/tasks.md."
  echo ""
fi

# 경고만 출력, 차단하지 않음
exit 0
