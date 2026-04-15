---
name: ygg-create
description: "새 기능/수정 제안서(proposal) 작성. YGG Point 스코어링으로 명세 완성도를 검증하고, 충분히 명확해질 때까지 질문을 던짐. /ygg:create 커맨드로 실행."
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

## Stage Responsibility

- `ygg-create`는 전체 파이프라인의 시작점이다. 여기서 토픽을 만들고 `ygg-next`로 넘길 준비를 끝낸다.
- 이후 워크플로우는 `ygg-next`가 설계와 작업 계획을 만들고, `ygg-add`가 구현을 수행하며, `ygg-qa`가 최종 검증과 완료 처리를 담당한다.
- 이 체인은 `ygg-qa`에서 검증이 모두 통과하고 토픽이 `ygg/change/archive/`로 이동할 때만 종료된다.

## Edge Cases

- **Topic exists**: 덮어쓰기 / 다른 이름 / Cancel 선택
- **ygg/ 없음**: 자동 생성
- **5라운드 후 미달**: 현재 점수로 진행 옵션 제시
- **상세 초기 입력**: baseFill 높으면 질문 감소 (최소 1라운드)
