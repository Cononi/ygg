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
4. **구현 방식 선택** — AskUserQuestion: "전체 구현 시도 (Recommended)" / "문서로 검증 가능한 task만 자동 완료" / "Stop"
5. **태스크별 구현** — 열린 체크리스트 항목마다 저장소 전용 구현을 먼저 시도하고, 그 구현기가 없으면 기존 산출물로 증명 가능한 task만 자동 완료
6. **내장 자동 완료 기준** — `design.md`, `specs/spec-core/spec.md`, `tasks.md`, `ygg-point.json` next snapshot, `INDEX.md` stage 전환, 일일 로그처럼 산출물 존재로 증명 가능한 task만 완료 처리
7. **변경 로그** — `ygg/change/{topic}/{YYYY-MM-DD}.md`: Why, Spec, Completed, Pending
8. **INDEX.md 업데이트** — 첫 구현 시 단계를 `add`로 변경
9. **구현 완료 후** — AskUserQuestion: "검증 시작 (Recommended)" / "추가 구현" / "Stop"
10. **Auto-chain** — "검증 시작" 선택 시 ygg-qa workflow 즉시 인라인 실행

## Stage Responsibility

- `ygg-add`의 역할은 `tasks.md`에 정의된 작업을 순서대로 구현하는 것이다.
- 구현 중에는 `design.md`와 `specs/`를 벗어나지 않아야 하며, 진행 상황은 즉시 `tasks.md`와 일일 변경 로그에 반영해야 한다.
- 이 단계의 종료는 코드 작성 자체가 아니라, 검증 가능한 구현 상태를 만들고 `ygg-qa`로 넘기는 것이다.
- 범용 CLI는 산출물로 검증 가능한 task만 자동 완료할 수 있다. 실제 저장소 코드 수정은 저장소 전용 구현 훅이나 주 작업 AI가 수행해야 한다.

## Rules

- tasks.md에 없는 작업 구현 거부
- specs/ 제약 및 design.md 결정 준수
- lint/typecheck 실패 시 다음 태스크 전에 수정

## Bug Discovery

버그 발견 시 AskUserQuestion: "지금 수정 + 로그 기록" / "별도 토픽으로 기록" / "작업 중단"

## Partial Implementation

진행 상태는 tasks.md에 저장. 다음 `/ygg:add` 호출 시 이어서 진행.
