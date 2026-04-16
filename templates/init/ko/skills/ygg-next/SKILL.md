---
name: ygg-next
description: "활성 proposal의 설계(design), 스펙(spec), 작업 목록(tasks) 수립. 아키텍처 결정사항을 YGG Point로 검증. /ygg:next 커맨드로 실행."
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# ygg-next — Design + Spec + Tasks with YGG Point

Refer to `ygg-core` for shared rules, formats, and YGG Point system.

## Scoring Dimensions (next stage — design focus)

| Dimension | Weight | Measures |
|-----------|--------|----------|
| architecture | 0.25 | 구현 구조/패턴 |
| tradeoff | 0.25 | 선택의 장단점 |
| constraint | 0.20 | 기술적/비기능적 제약 |
| dependency | 0.15 | 구현 순서, 모듈 의존 |
| rollback | 0.15 | 롤백 가능성 |

## Workflow

0. **Local LLM 체크** — `Bash: ygg llm status --json`. `active !== null`이면 step 4 채점을 `ygg llm score`, step 6–8의 design/specs/tasks 합성을 `ygg llm write --type design|spec|tasks`로 위임. 0이 아닌 exit code면 보고 후 중단 — ygg-core의 Local LLM Delegation 섹션 참조.
1. **Active Topic 찾기** — INDEX.md에서 단계=`create` 토픽 (ygg-core 참조)
2. **proposal.md + ygg-point.json 읽기** — create 이력과 score trail을 읽어 중복 질문을 막고 점수 상승 이유를 이어간다
3. **코드베이스 분석** — Impact 관련 소스, 아키텍처, 의존성, 테스트, git log
4. **Round 0** — proposal + 코드 분석으로 baseFill을 계산하고 reference/consistency 후보를 점검한다. `ygg point auto-mode=on`일 때만 내부 자동 검증하고, `off`일 때는 사용자 질문 흐름에 남긴다 → 점수 표시
5. **Question Loop** — `ygg point auto-mode=off`이면 design/spec/tasks를 생성하기 전에 각 차원별 최소 5회의 사용자 질문 답변을 먼저 받아야 한다. 모든 선택지는 번호 목록으로 제시하고, 터미널에서는 숫자 키 또는 방향키로 선택 가능해야 한다. 그 최소 횟수를 채운 뒤에는 일반 threshold 루프로 돌아가 추가 진행 여부를 다시 묻는다
6. **design.md 생성** — ygg-core의 design 포맷. Q&A + proposal + 코드 분석 종합
7. **specs/ 생성** — 컴포넌트별 spec.md (ygg-core 포맷)
8. **tasks.md 생성** — design의 Migration Plan 순서 기반 체크리스트 (ygg-core 포맷)
9. **ygg-point.json 업데이트** — next stage summary와 차원 score trail 추가. top-level 초기 요청 문장은 유지
10. **INDEX.md 업데이트** — 단계를 `next`로 변경
11. **Summary + Next** — AskUserQuestion: "구현 시작 (Recommended)" / "design/spec/tasks 수정" / "Cancel"
12. **Auto-chain** — "구현 시작" 선택 시 ygg-add workflow 즉시 인라인 실행

## Stage Responsibility

- `ygg-next`의 역할은 proposal을 구현 가능한 계획으로 바꾸는 것이다.
- 산출물은 반드시 `design.md`, `specs/`, `tasks.md`이며, 이 세 문서는 다음 단계인 `ygg-add`의 유일한 구현 기준이 된다.
- 이 단계는 구현을 직접 완료하는 단계가 아니라, 구현 순서와 제약을 명확히 고정하는 단계다.

## Edge Cases

- **Topic 없음**: `/ygg:create` 안내
- **design.md 이미 존재**: 덮어쓰기 / 수정 / Cancel
- **proposal 불충분**: 축약 create 스코어링 실행
- **대규모 scope**: 여러 spec + 세분화된 tasks 생성
