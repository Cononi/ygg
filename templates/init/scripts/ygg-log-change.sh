#!/usr/bin/env bash
# ygg-log-change.sh
# 토픽 기반 변경 기록 생성
#
# 사용법:
#   bash ygg/scripts/ygg-log-change.sh "<topic>" "<summary>"
#   bash ygg/scripts/ygg-log-change.sh --archive "<topic>"
#
# 예시:
#   bash ygg/scripts/ygg-log-change.sh "apply-command" "apply 통합 커맨드 구현"
#   bash ygg/scripts/ygg-log-change.sh --archive "apply-command"

set -euo pipefail

TODAY=$(date +%Y-%m-%d)

# --archive 모드: 토픽을 archive/로 이동
if [ "${1:-}" = "--archive" ]; then
  TOPIC="${2:?Usage: ygg-log-change.sh --archive <topic>}"
  SRC="ygg/change/${TOPIC}"

  if [ ! -d "$SRC" ]; then
    echo "[ygg] Topic not found: ${SRC}"
    exit 1
  fi

  if ! command -v ygg >/dev/null 2>&1; then
    echo "[ygg] 'ygg' command not found. Refusing partial archive without version/index updates."
    echo "[ygg] Install ygg or archive through the dashboard/API path."
    exit 1
  fi

  ygg archive "$TOPIC"
  exit $?
fi

# 일반 모드: 토픽 폴더 + 날짜 파일 생성
TOPIC="${1:?Usage: ygg-log-change.sh <topic> <summary>}"
SUMMARY="${2:-No summary provided}"
TOPIC_DIR="ygg/change/${TOPIC}"
FILE="${TOPIC_DIR}/${TODAY}.md"

mkdir -p "$TOPIC_DIR"

# 이미 오늘 파일이 있으면 생성하지 않음
if [ -f "$FILE" ]; then
  echo "[ygg] File already exists: ${FILE}"
  exit 0
fi

cat > "$FILE" << EOF
## Why
${SUMMARY}

## Spec
_TODO: 변경 대상, 결정 사항, 제약 조건_

## Changes
_TODO: 변경 파일 목록_

## Tasks
- [ ] _TODO: 작업 목록_
EOF

echo "[ygg] Topic created: ${FILE}"
