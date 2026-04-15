---
name: ygg-add
description: "{{skill_add_description}}"
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# ygg-add — Task Review & Implementation

Refer to `ygg-core` for shared rules and formats.

## Workflow

1. **Active Topic 찾기** — INDEX.md에서 단계=`next`/`add` 토픽 (ygg-core 참조)
2. **문서 읽기** — tasks.md, design.md, specs/
3. **Task Status 표시** — ✅/⬜ 목록 + 진행률
4. **구현 방식 선택** — AskUserQuestion: "전체 구현 (Recommended)" / "특정 태스크 선택" / "요구사항 수정" / "Cancel"
5. **태스크별 구현** — spec 확인 → 코드 작성 → lint/typecheck → tasks.md 체크 → 변경 로그 기록
6. **변경 로그** — `ygg/change/{topic}/{YYYY-MM-DD}.md`: Why, Spec, Changes, Tasks
7. **INDEX.md 업데이트** — 첫 구현 시 단계를 `add`로 변경
8. **구현 완료 후** — AskUserQuestion: "검증 시작 (Recommended)" / "추가 구현" / "Stop"
9. **Auto-chain** — "검증 시작" 선택 시 ygg-qa workflow 즉시 인라인 실행

## Rules

- tasks.md에 없는 작업 구현 거부
- specs/ 제약 및 design.md 결정 준수
- lint/typecheck 실패 시 다음 태스크 전에 수정

## Bug Discovery

버그 발견 시 AskUserQuestion: "지금 수정 + 로그 기록" / "별도 토픽으로 기록" / "작업 중단"

## Partial Implementation

진행 상태는 tasks.md에 저장. 다음 `/ygg:add` 호출 시 이어서 진행.
