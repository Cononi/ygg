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

0. **Local LLM 체크** — `Bash: ygg llm status --json`. `active !== null`이면 step 3 채점을 `ygg llm score --dimensions <dims.json> --input <topic.md>`, step 6 proposal 합성을 `ygg llm write --type proposal --input <context.json>`로 위임. 0이 아닌 exit code면 보고 후 중단 — ygg-core의 Local LLM Delegation 섹션 참조.
1. **Arguments 확인** — 없으면 AskUserQuestion으로 설명 요청
2. **Auto-mode 선택** — `ygg point auto-mode`가 아직 없으면 반드시 인터랙티브 `on/off` 선택지를 먼저 보여준다. 터미널에서는 화살표 선택 UI가 필수다. 이 설정은 create 단계에만 적용한다
3. **Round 0** — baseFill을 계산하고 reference/consistency 후보를 점검한다. `ygg point auto-mode=on`일 때만 내부 자동 검증하고, `off`일 때는 사용자 질문 흐름에 남긴다 → 점수 표시
4. **Interactive Question Loop** — 질문은 반드시 한 번에 하나씩만 묻는다. 같은 질문을 반복하지 않는다. 가장 중요한 부족 정보를 겨냥해 티키타카 식으로 round를 이어가며 0.95 이상 또는 더 나은 질문이 없을 때까지 진행한다
5. **Directory 생성** — `ygg/change/{topic-name}/`
6. **proposal.md 생성** — ygg-core의 proposal 포맷으로 Q&A 결과를 종합한다. 이 질문 품질이 이후 design/spec/tasks 품질을 좌우한다
7. **ygg-point.json 저장** — 작성자가 처음 남긴 요청 문장을 top-level에 기록하고, stage summary와 점수 이전/이후가 연결된 차원별 질문/답변 trail만 저장한다. 각 trail entry는 전역 증가 round를 유지해야 한다
8. **INDEX.md 업데이트** — 새 토픽 등록 (🔄 진행중, create)
9. **Next Steps** — AskUserQuestion을 반드시 인터랙티브 선택지로 제공: "설계 단계로 계속 (Recommended)" / "proposal 수정" / "Cancel"
10. **Auto-chain** — "설계 단계로 계속" 선택 시 ygg-next workflow 즉시 인라인 실행

## Edge Cases

- **Topic exists**: 덮어쓰기 / 다른 이름 / Cancel 선택
- **ygg/ 없음**: 자동 생성
- **점수가 낮은 토픽**: 고정 개수보다, proposal이 정확해질 때까지 한 번에 한 질문씩 보강한다
- **상세 초기 입력**: 이미 구체적인 요청이면 더 적은 라운드로 끝날 수 있다
