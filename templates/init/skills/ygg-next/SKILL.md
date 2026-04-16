---
name: ygg-next
description: "{{skill_next_description}}"
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

0. **Local LLM 체크** — `Bash: ygg llm status --json`. `active !== null`이면 step 5–7의 design/specs/tasks 합성을 `ygg llm write --type design|spec|tasks`로 위임. 0이 아닌 exit code면 보고 후 중단 — ygg-core의 Local LLM Delegation 섹션 참조.
1. **Active Topic 찾기** — INDEX.md에서 단계=`create` 토픽 (ygg-core 참조)
2. **proposal.md + ygg-point.json 읽기** — create 이력과 score trail을 읽어 설계 근거를 이어간다
3. **코드베이스 분석** — Impact 관련 소스, 아키텍처, 의존성, 테스트, git log
4. **새 질문 없음** — `ygg-next`는 사용자에게 질문하지 않는다. proposal, top-level 초기 요청, create에서 누적된 trail만으로 설계 문서를 생성한다
5. **design.md 생성** — ygg-core의 design 포맷. create stage evidence + proposal + 코드 분석을 종합한다
6. **specs/ 생성** — 컴포넌트별 spec.md (ygg-core 포맷)
7. **tasks.md 생성** — design의 Migration Plan 순서 기반 체크리스트 (ygg-core 포맷)
8. **ygg-point.json 업데이트** — next stage summary를 추가하되 top-level 초기 요청 문장과 create trail은 유지
9. **INDEX.md 업데이트** — 단계를 `next`로 변경
10. **Summary + Next** — AskUserQuestion: "구현 시작 (Recommended)" / "design/spec/tasks 수정" / "Cancel"
11. **Auto-chain** — "구현 시작" 선택 시 ygg-add workflow 즉시 인라인 실행

## Stage Responsibility

- `ygg-next`의 역할은 proposal을 구현 가능한 계획으로 바꾸는 것이다.
- 산출물은 반드시 `design.md`, `specs/`, `tasks.md`이며, 이 세 문서는 다음 단계인 `ygg-add`의 유일한 구현 기준이 된다.
- 이 단계는 구현을 직접 완료하는 단계가 아니라, 구현 순서와 제약을 명확히 고정하는 단계다.

## Edge Cases

- **Topic 없음**: `/ygg:create` 안내
- **design.md 이미 존재**: 덮어쓰기 / 수정 / Cancel
- **proposal 불충분**: create에서 확보된 trail을 기준으로 보수적으로 정리
- **대규모 scope**: 여러 spec + 세분화된 tasks 생성
