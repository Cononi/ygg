---
name: ygg-core
description: "모든 /ygg:* 커맨드의 공유 규칙과 포맷 정의. OpenSpec-like 파이프라인(create→next→add→qa), per-change 디렉토리 구조, 문서 포맷, AskUserQuestion 상호작용 규칙. ygg skill과 함께 자동 활성화."
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
done          → 완료 처리 + archive 이동
```

Each stage auto-chains to next on user approval. Cancel stops the chain.

## Stage Roles

| Stage | Skill | 역할 | 완료 조건 |
|------|-------|------|----------|
| create | ygg-create | 변경 의도와 범위를 proposal로 확정하고 체인을 시작 | proposal.md + ygg-point.json + INDEX create |
| next | ygg-next | design/spec/tasks를 만들어 구현 가능한 계획으로 구체화 | design.md + specs/ + tasks.md + INDEX next |
| add | ygg-add | tasks.md 순서대로 구현하고 변경 로그를 남김 | 코드 반영 + tasks 진행 + INDEX add |
| qa | ygg-qa | 빌드/테스트/린트/타입체크와 spec cross-check로 증거 기반 검증 | 모든 검증 통과 + 완료 처리 + archive 이동 |

워크플로우는 `ygg-create`에서 시작해 `ygg-next → ygg-add → ygg-qa`를 순서대로 거친 뒤, 마지막에 완료 처리와 archive 이동까지 끝나야 종료된다.

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

**루프**: 가장 부족한 정보를 겨냥해 질문을 정확히 한 번에 하나씩 묻고 → 답변 반영 → 점수 재계산 → 반복.
`ygg-create`에서만 auto-verifiable한 `reference` / `consistency` evaluator가 `ygg point auto-mode` 설정의 영향을 받는다. `on`일 때만 먼저 내부 처리하고, `off`일 때는 사용자 확인 기반 질문 흐름으로 남긴다.
`ygg-next`는 새 질문을 받지 않고 create 단계에서 누적된 데이터로 설계 문서를 생성한다.
차원별 최소 5회 같은 고정 규칙은 두지 않는다. 스테이지 점수가 0.95 이상이 되거나 더 나은 질문이 남지 않을 때까지 루프를 계속한다.
저장되는 모든 답변은 차원, evaluator, answerSource, 점수 이전/이후 값과 함께 묶여서 Topic Detail이 점수 상승 이유를 설명할 수 있어야 한다. `questionTrail.round`는 스테이지 전체에서 1, 2, 3, ... 계속 증가해야 한다.

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
중복되는 top-level `history`는 만들지 않는다. 질문/답변 이력은 각 차원의 `questionTrail` 안에만 유지한다.
스키마는 가볍게 유지한다. top-level 초기 요청 문장과 점수/상태 메타데이터, stage별 `initialScore`, `finalScore`, `delta`, 그리고 점수 변화를 설명하는 데 필요한 차원별 `questionTrail` 중심 정보만 저장하고, 중복되거나 소비되지 않는 필드는 제거한다.

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
6. AskUserQuestion 필수 사용, 자동 선택 금지
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

`ygg llm`으로 `llm.active`가 설정되면, `ygg:add` 단계에서 코드 생성을 LM Studio에 위임하여 주 실행 AI의 토큰 사용량을 줄일 수 있다.

**먼저 체크** — `ygg:add`는 step 0에서 `Bash: ygg llm status --json`을 실행한다. `active === null`이면 위임을 건너뛰고 직접 구현.

**위임 매트릭스**:

| 작업 | 활성 시 | 비활성 시 |
|------|--------|----------|
| `ygg:add` 코드 초안 생성 | `ygg llm code --context <file> --task <desc>` → stdout | Primary AI |
| `ygg:add` 파일 적용 (Write/Edit) | Primary AI | Primary AI |
| 코드 읽기 (Read/Grep/Glob) | Primary AI | Primary AI |
| create/next/qa 문서 합성 | Primary AI | Primary AI |

**절대 위임 금지**: create/next/qa 단계, 문서 합성, 설계 결정 — 모두 주 실행 AI가 담당한다.

**실패 처리**: `ygg llm code`가 0이 아닌 exit code로 종료되면(2=비활성, 8=타임아웃, 10=컨텍스트 없음, 12=어댑터 오류), 직접 코드 작성으로 폴백하고 이유를 로그에 기록.
