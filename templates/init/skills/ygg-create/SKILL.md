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
2. **Round 0** — baseFill을 계산하고 reference/consistency 후보를 점검한다. `ygg point auto-mode=on`일 때만 내부 자동 검증하고, `off`일 때는 사용자 질문 흐름에 남긴다 → 점수 표시
3. **Question Loop** — `ygg point auto-mode=off`이면 proposal을 마무리하기 전에 각 차원별 최소 5회의 사용자 질문 답변을 먼저 받아야 한다. 모든 선택지는 번호 목록으로 제시하고, 터미널에서는 숫자 키 또는 방향키로 선택 가능해야 한다. 그 최소 횟수를 채운 뒤에는 일반 threshold 루프로 돌아가 기본 5회 초과 진행 여부를 다시 선택한다
4. **Directory 생성** — `ygg/change/{topic-name}/`
5. **proposal.md 생성** — ygg-core의 proposal 포맷으로 Q&A 결과 종합
6. **ygg-point.json 저장** — 작성자가 처음 남긴 요청 문장을 top-level에 기록하고, stage summary와 점수 이전/이후가 연결된 차원별 질문/답변 trail만 저장
7. **INDEX.md 업데이트** — 새 토픽 등록 (🔄 진행중, create)
8. **Next Steps** — AskUserQuestion: "설계 단계로 계속 (Recommended)" / "proposal 수정" / "Cancel"
9. **Auto-chain** — "설계 단계로 계속" 선택 시 ygg-next workflow 즉시 인라인 실행

## Edge Cases

- **Topic exists**: 덮어쓰기 / 다른 이름 / Cancel 선택
- **ygg/ 없음**: 자동 생성
- **점수가 낮은 토픽**: auto-mode가 `off`이면 각 차원 최소 5회 사용자 질답 전에는 proposal을 생성하지 않는다. 그 이후에는 특정 차원을 더 올릴지, 현재 점수로 proposal을 생성할지 선택
- **상세 초기 입력**: baseFill 높으면 질문 감소 (최소 1라운드)
