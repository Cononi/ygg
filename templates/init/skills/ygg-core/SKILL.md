---
name: ygg-core
description: "{{skill_core_description}}"
allowed_tools:
  - Read
  - AskUserQuestion
---

# ygg-core — Shared Rules

All `/ygg:*` commands follow these rules.

## Pipeline

```
create <설명> → proposal.md
next          → design.md + specs/ + tasks.md
add           → 구현 실행
qa            → 빌드/테스트/검증
```

Each stage auto-chains to next on user approval. Cancel stops the chain.

## Directory Structure

```
ygg/change/
├── INDEX.md                 ← 토픽 목록 + 상태
├── {topic}/
│   ├── proposal.md          ← create
│   ├── design.md            ← next
│   ├── specs/{component}/spec.md ← next
│   ├── tasks.md             ← next
│   ├── ygg-point.json       ← 점수 변화와 연결된 질답 포함 스코어링 이력
│   └── YYYY-MM-DD.md        ← add (일별 변경 로그)
└── archive/                 ← qa 통과 후 이동
```

## YGG Point Scoring

스코어 기반 질문 루프. 0.95+ 도달 시 문서 생성.

**계산**: `dimension_score = baseFill × 0.3 + qualityScore × 0.7`, `total = Σ(score × weight)`

**Evaluators** (차원당 4개):
- **humanistic/domain**: 사용자 답변 필수
- **reference/consistency**: 코드/문서로 자동 검증

**루프**: 가장 낮은 차원에서 한 번에 질문 하나만 선택 → 답변 반영 → 점수 재계산 → 반복.
`ygg-create`에서만 auto-verifiable한 `reference` / `consistency` evaluator가 `ygg point auto-mode` 설정의 영향을 받는다. `on`일 때만 먼저 내부 처리하고, `off`일 때는 사용자 확인 기반 질문 흐름으로 남긴다.
`ygg-next`는 새 질문을 받지 않고 create 단계에서 누적된 데이터만으로 design/spec/tasks를 생성한다.
저장되는 모든 답변은 차원, displayName, evaluator, answerSource, 점수 이전/이후 값과 함께 묶여서 Topic Detail이 점수 상승 이유를 설명할 수 있어야 한다.
`questionTrail.round`는 스테이지 전체에서 1, 2, 3, 4, ...처럼 계속 증가하며, 어떤 질문으로 점수가 얼마나 올라갔는지 보여줘야 한다.
스테이지 점수가 0.95 이상이 될 때까지 루프를 계속한다.

## Document Formats

### proposal.md
`Why` → `What Changes` → `Capabilities` (New/Modified) → `Impact` (파일, 범위) → `Boundary` (Non-Goals)

### design.md
`Context` → `Goals/Non-Goals` → `Decisions` (결정/이유/대안) → `Constraints` → `Risks/Trade-offs` → `Migration Plan` → `Open Questions`

### specs/{component}/spec.md
`Requirements` (체크리스트) → `Constraints` → `Interface`

### tasks.md
번호 매긴 단계별 `- [ ]` 체크리스트. 마지막 단계는 항상 "검증".

### INDEX.md
`| 토픽 | 상태 | 단계 | 마지막 날짜 |` 테이블 + Archive 섹션.
상태: 🔄 진행중 / ✅ 완료. 단계: create → next → add → qa.

### ygg-point.json
top-level `requestText`에는 최초 요청 메시지를 유지한다. dashboard에서 항상 이 값이 최상단에 보여야 한다.
질문/답변 이력은 각 차원의 `questionTrail` 안에 유지하고, 차원별 `displayName`, `initialScore`, `finalScore`, `delta`를 함께 저장한다.
round는 스테이지 전체에서 1, 2, 3, ... 계속 증가해야 하며, 각 라운드마다 질문, 답변, 점수 향상량을 남긴다.

## Active Topic Detection

1. Read `ygg/change/INDEX.md`
2. `🔄 진행중` 토픽 중 해당 단계 찾기 (다수 시 최근 날짜)
3. 없으면 적절한 커맨드 안내

## Rules

1. Pipeline 순서 준수
2. `/ygg:create`는 기존 컨텍스트 읽지 않음 (fresh start)
3. Scope guard — proposal 외 구현 금지
4. Spec 제약 준수
5. tasks.md 즉시 업데이트
6. create 단계에서 질문은 티키타카 형식으로 한 번에 하나씩만 진행한다
7. 모든 사용자 선택지는 반드시 인터랙티브 입력이어야 한다. 터미널에서는 화살표 선택 UI를 기본으로 먼저 제공해야 하며, 숫자 입력은 보조 단축키일 뿐 이를 대체할 수 없다
8. 추천 옵션에 `(Recommended)`, Cancel/Skip 항상 포함
9. Deprecated API 사용 금지 — 최신 대체로 마이그레이션
10. 모든 ygg/ 문서 200줄 미만 유지

## Reading Rules

| Command | Reads | Does NOT read |
|---------|-------|---------------|
| create | **Nothing** | change |
| next | proposal.md, ygg-point.json | other topics |
| add | design.md, specs/, tasks.md | other topics |
| qa | tasks.md, specs/, design.md | archive |
| status | change/INDEX.md | individual files |

## Local LLM Delegation (LM Studio)

`ygg llm`으로 `llm.active`가 설정되면, `ygg:add` 단계에서 코드 생성을 LM Studio에 위임하여 주 작업 AI의 토큰을 절감한다.

**먼저 체크** — `ygg:add`는 step 0에서 `Bash: ygg llm status --json`을 실행한다. `active === null`이면 위임을 건너뛰고 직접 구현.

**위임 매트릭스**:

| 작업 | 활성 시 | 비활성 시 |
|------|--------|----------|
| `ygg:add` 코드 초안 생성 | `ygg llm code --context <file> --task <desc>` → stdout | 주 작업 AI |
| `ygg:add` 파일 적용 (Write/Edit) | 주 작업 AI | 주 작업 AI |
| 코드 읽기 (Read/Grep/Glob) | 주 작업 AI | 주 작업 AI |
| create/next/qa 문서 합성 | 주 작업 AI | 주 작업 AI |

**절대 위임 금지**: create/next/qa 단계, 문서 합성, 설계 결정 — 모두 주 작업 AI가 담당.

**실패 처리**: `ygg llm code`가 0이 아닌 exit code로 종료되면(2=비활성, 8=타임아웃, 10=컨텍스트 없음, 12=어댑터 오류), 직접 코드 작성으로 폴백하고 이유를 로그에 기록.
