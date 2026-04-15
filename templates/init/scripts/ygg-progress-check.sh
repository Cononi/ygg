#!/usr/bin/env bash
# ygg-progress-check.sh
# Hook: Stop — Claude 응답 완료 후 ygg/change/ 문서 갱신 여부 확인
#
# 동작:
#   1. .ygg-changed 파일이 있으면 (PostToolUse hook이 기록) 코드 변경이 있었다는 뜻
#   2. ygg/change/ 하위 파일이 함께 변경되지 않았으면 경고 출력
#   3. 경고 메시지는 Claude에게 피드백으로 전달됨

set -euo pipefail

TRACKER=".ygg-changed"

# 변경 추적 파일이 없으면 코드 변경 없음 → 체크 불필요
if [ ! -f "$TRACKER" ]; then
  exit 0
fi

# 변경된 파일 목록 읽기
CHANGED_FILES=$(cat "$TRACKER")
CHANGE_UPDATED=false

# ygg/change/ 하위 파일이 변경 목록에 있는지 확인
if echo "$CHANGED_FILES" | grep -q "ygg/change/"; then
  CHANGE_UPDATED=true
fi

# 코드 파일 변경이 있었는지 확인 (ygg/, .claude/ 제외)
CODE_CHANGED=false
while IFS= read -r file; do
  case "$file" in
    ygg/*|.claude/*|*.md) ;;
    src/*|lib/*|test/*|tests/*) CODE_CHANGED=true; break ;;
  esac
done <<< "$CHANGED_FILES"

# 코드 변경은 있는데 change 문서 갱신이 없으면 경고
if [ "$CODE_CHANGED" = true ] && [ "$CHANGE_UPDATED" = false ]; then
  echo ""
  echo "[ygg] Code files were modified but ygg/change/ documents were not updated."
  echo "[ygg] If you implemented a task, update the change log or run /ygg:status to review."
  echo ""
fi

# 추적 파일 정리
rm -f "$TRACKER"
