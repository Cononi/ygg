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

0. **Local LLM 체크** — `Bash: ygg llm status --json`. `active !== null`이면 step 4 채점을 `ygg llm score`, step 6–8의 design/specs/tasks 합성을 `ygg llm write --type design|spec|tasks`로 위임. 0이 아닌 exit code면 보고 후 중단 — ygg-core의 Local LLM Delegation 섹션 참조.
1. **Active Topic 찾기** — INDEX.md에서 단계=`create` 토픽 (ygg-core 참조)
2. **proposal.md + ygg-point.json 읽기** — create 이력으로 중복 질문 방지
3. **코드베이스 분석** — Impact 관련 소스, 아키텍처, 의존성, 테스트, git log
4. **Round 0** — proposal + 코드 분석으로 baseFill 계산, reference/consistency 자동 검증 → 점수 표시
5. **Question Loop** — 0.95 미만이면 ygg-core의 YGG Point 루프 실행
6. **design.md 생성** — ygg-core의 design 포맷. Q&A + proposal + 코드 분석 종합
7. **specs/ 생성** — 컴포넌트별 spec.md (ygg-core 포맷)
8. **tasks.md 생성** — design의 Migration Plan 순서 기반 체크리스트 (ygg-core 포맷)
9. **ygg-point.json 업데이트** — next stage 이력 추가
10. **INDEX.md 업데이트** — 단계를 `next`로 변경
11. **Summary + Next** — AskUserQuestion: "구현 시작 (Recommended)" / "design/spec/tasks 수정" / "Cancel"
12. **Auto-chain** — "구현 시작" 선택 시 ygg-add workflow 즉시 인라인 실행

## Edge Cases

- **Topic 없음**: `/ygg:create` 안내
- **design.md 이미 존재**: 덮어쓰기 / 수정 / Cancel
- **proposal 불충분**: 축약 create 스코어링 실행
- **대규모 scope**: 여러 spec + 세분화된 tasks 생성
