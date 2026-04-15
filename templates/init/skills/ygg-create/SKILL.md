---
name: ygg-create
description: "{{skill_create_description}}"
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# ygg-create — New Proposal with YGG Point

Refer to `ygg-core` for shared rules, formats, and YGG Point system.

## Rule: Fresh Start

**DO NOT read** existing ygg/ documents. Only read project source if needed for context.

## Scoring Dimensions (create stage)

| Dimension | Weight | Measures |
|-----------|--------|----------|
| motivation | 0.25 | 왜 변경이 필요한가 |
| scope | 0.25 | 변경 범위와 대상 |
| user-story | 0.20 | 누가 어떻게 사용하는가 |
| boundary | 0.15 | 하지 않을 것 (Non-Goals) |
| impact | 0.15 | 영향받는 파일/모듈 |

## Workflow

0. **Local LLM 체크** — `Bash: ygg llm status --json`. `active !== null`이면 step 2 채점을 `ygg llm score --dimensions <dims.json> --input <topic.md>`, step 5 proposal 합성을 `ygg llm write --type proposal --input <context.json>`로 위임. 0이 아닌 exit code면 보고 후 중단 — ygg-core의 Local LLM Delegation 섹션 참조.
1. **Arguments 확인** — 없으면 AskUserQuestion으로 설명 요청
2. **Round 0** — baseFill 계산 + reference/consistency 자동 검증 (CLAUDE.md, package.json, git log) → 점수 표시
3. **Question Loop** — 0.95 미만이면 ygg-core의 YGG Point 루프 실행
4. **Directory 생성** — `ygg/change/{topic-name}/`
5. **proposal.md 생성** — ygg-core의 proposal 포맷으로 Q&A 결과 종합
6. **ygg-point.json 저장** — stage, score, breakdown, history
7. **INDEX.md 업데이트** — 새 토픽 등록 (🔄 진행중, create)
8. **Next Steps** — AskUserQuestion: "설계 단계로 계속 (Recommended)" / "proposal 수정" / "Cancel"
9. **Auto-chain** — "설계 단계로 계속" 선택 시 ygg-next workflow 즉시 인라인 실행

## Edge Cases

- **Topic exists**: 덮어쓰기 / 다른 이름 / Cancel 선택
- **ygg/ 없음**: 자동 생성
- **5라운드 후 미달**: 현재 점수로 진행 옵션 제시
- **상세 초기 입력**: baseFill 높으면 질문 감소 (최소 1라운드)
