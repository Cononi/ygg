---
name: ygg-teams
description: >
  전문가 조언/평가 모드 토글 및 실행. 에이전트 팀 기반으로 아키텍처/UI·UX/데이터/보안/성능
  전문가가 설계를 검증하고 점수를 채점. 선별된 전문가 전원 0.95 이상 시 구현 단계로 진행.
  Triggered by /ygg:teams command.
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# ygg-teams — 전문가 조언/평가 모드

Refer to `ygg-core` skill for shared rules and formats.

## Overview

에이전트 팀 기능을 활용하여 설계 문서를 다각도로 검증하는 전문가 평가 모드.
활성화 토글 방식으로 기존 워크플로우에 전문가 평가 단계를 삽입/해제한다.

- 활성화 시: `create → next → **[전문가 평가 ⟳ 설계 수정 루프]** → add → qa`
- 비활성화 시: `create → next → add → qa`

## Expert Pool (5종)

| 전문가 | Agent 정의 | 선별 기준 |
|---|---|---|
| 🏗️ 아키텍처 | `expert-architect` | 모듈, 계층, API, 의존성, 구조 변경 |
| 🎨 UI/UX | `expert-uiux` | CLI, 인터페이스, 명령어, 출력 형식 |
| 📊 데이터 | `expert-data` | 스키마, JSON, 데이터 흐름, 파싱 |
| 🔒 보안 | `expert-security` | 인증, 권한, 입력 검증, 파일 접근 |
| ⚡ 성능 | `expert-performance` | 대량 처리, 병렬, 캐싱, 토큰 비용 |

## Workflow

### 1. Toggle Mode (인자: on/off/없음)

인자가 있으면 토글 처리:

**on:**
1. `.claude/settings.json`의 `env` 에 `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` 추가
2. 파일이 없으면 생성, 있으면 env 섹션에 병합
3. "✅ 전문가 평가 모드 활성화됨" 안내

**off:**
1. `.claude/settings.json`의 `env`에서 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` 제거
2. "❌ 전문가 평가 모드 비활성화됨" 안내

**인자 없음:**
1. 현재 상태 확인 후 AskUserQuestion으로 토글 선택지 제시

### 2. Expert Review Execution (ygg-next에서 체이닝 시)

ygg-next 완료 후 자동 호출되거나, 사용자가 직접 실행할 때:

#### Step 1: 활성 토픽 확인
1. `ygg/change/INDEX.md`에서 단계 = `next`인 토픽 찾기
2. `proposal.md` + `design.md` 읽기

#### Step 2: 전문가 자동 선별
1. proposal.md + design.md 내용을 분석
2. 각 전문가의 선별 키워드와 매칭하여 관련도 계산
3. 관련도 높은 전문가를 선별 (최소 2명, 최대 5명)
4. 선별 결과를 AskUserQuestion으로 사용자에게 제시:
   ```
   question: "다음 전문가가 선별되었습니다. 수정하시겠습니까?"
   options:
     - "이대로 진행 (Recommended)"
     - "전문가 추가/제거"
   ```

#### Step 3: 에이전트 팀 생성
1. 선별된 전문가를 에이전트 팀 팀원으로 생성
   ```
   Create an agent team for expert design review.
   Spawn teammates using these agent types: {선별된 전문가 목록}
   Each teammate should:
   - Read ygg/change/{topic}/proposal.md and design.md
   - Optionally explore the codebase for context
   - Evaluate the design from their expertise perspective
   - Score the design (0.00~1.00) using their Scoring Rubric
   - Report findings in the specified Output Format
   
   After individual evaluations, have teammates discuss and challenge
   each other's findings. Focus on conflicting assessments.
   
   Use Sonnet for each teammate.
   Require plan approval before they make any changes.
   ```
2. 에러 발생 시: 에러 내용 보고 + 재시도 안내

#### Step 4: 점수 수집 및 판정
1. 각 전문가의 평가 결과와 점수를 수집
2. 전문가 간 토론 내용을 요약
3. 판정:
   - **전원 ≥ 0.95** → PASS
   - **1명이라도 < 0.95** → RETRY

#### Step 5: review.md 생성
1. `ygg/change/{topic}/review.md` 생성 (최신본)
2. `ygg/change/{topic}/review-r{N}.md` 이력 보존

내용 구성:
```markdown
# Expert Review: {topic} — Round {N}

## 선별된 전문가
| 전문가 | 선별 이유 |

## 전문가별 평가
### {전문가명}
**점수:** {0~1}
**강점:** ...
**이슈:** ...
**수정 방향:** ...

## 전문가 간 토론 요약
{핵심 토론 내용}

## 점수표
| 전문가 | R1 | R2 | ... | 상태 |

## 종합 판정
{PASS / RETRY + 미달 영역}
```

#### Step 6: 결과에 따른 분기

**PASS:**
```
AskUserQuestion:
  "✅ 전문가 전원 0.95 이상 달성. 다음 단계를 선택하세요."
  - "구현 시작 (Recommended)" → /ygg:add 체이닝
  - "review.md 확인 후 결정"
```

**RETRY:**
```
AskUserQuestion:
  "❌ 미달 영역이 있습니다. ({미달 전문가 목록})"
  - "수정 반영 — 전문가 권고를 design.md에 반영 (Recommended)"
  - "사용자 오버라이드 — 현재 상태로 구현 진행"
  - "직접 수정 후 재평가"
```

수정 반영 시:
1. 리더가 미달 전문가의 권고를 종합하여 design.md 수정안 작성
2. 사용자에게 수정 내용 확인 요청
3. 승인 시 design.md 갱신 → Step 3으로 돌아가 재평가

#### Step 7: 라운드 제한

5라운드 도달 시:
```
AskUserQuestion:
  "⚠️ 최대 라운드(5회)에 도달했습니다."
  - "현재 상태로 구현 진행 (사용자 오버라이드)"
  - "추가 1라운드 실행"
```

## Edge Cases

- **에이전트 팀 미지원**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` 미설정 시 활성화 방법 안내
- **design.md 미존재**: `/ygg:next`를 먼저 실행하도록 안내
- **review.md 이미 존재**: 기존 리뷰 위에 새 라운드를 추가할지 질문
- **에이전트 팀 생성 실패**: 에러 보고 + 재시도 안내
