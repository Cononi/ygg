---
name: ygg-qa
description: "{{skill_qa_description}}"
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# ygg-qa — Prove It Works

Refer to `ygg-core` for shared rules and formats.

증거 기반 검증. 추측 금지, 실제 명령 실행 결과로 증명.

## Workflow

0. **Local LLM 체크** — `Bash: ygg llm status --json`. `active !== null`이면 step 4의 빌드/테스트/린트 로그 요약을 `ygg llm summarize --input <log>`로 위임. 코드 수정은 Claude가 담당. 0이 아닌 exit code면 보고 후 중단 — ygg-core의 Local LLM Delegation 섹션 참조.
1. **Active Topic 찾기** — INDEX.md에서 단계=`add` 토픽 (ygg-core 참조)
2. **검증 문서 읽기** — tasks.md (검증 섹션), specs/, design.md
3. **검증 실행**:
   - **Build** — 프로젝트 빌드 도구 자동 감지 후 실행
   - **Lint & Typecheck** — 경고/에러 수 기록
   - **Tests** — 테스트 실행, 통과/실패 수 기록
   - **Spec Cross-check** — specs/ 요구사항을 코드 대비 검증 (pass/fail/partial)
   - **Tasks Check** — tasks.md 전체 항목 완료 확인
4. **Evidence Report** — 각 단계의 ✅/❌ + 실제 출력 발췌
5. **결과 처리**:
   - **All Pass**: 이 토픽은 최종 완료로 간주한다. tasks.md 체크 → active에서 즉시 archive로 이동 → INDEX.md 업데이트. QA 성공 후 active 상태로 남겨두는 것은 허용하지 않는다.
   - **Failures**: 실패 목록 + 수정 제안 → AskUserQuestion: "수정 후 재검증 (Recommended)" / "구현으로 돌아가기" / "Cancel"

## Build Tool Detection

| File | Build | Lint | Test |
|------|-------|------|------|
| `package.json` | `pnpm build` | `pnpm lint` | `pnpm test` |
| `Cargo.toml` | `cargo build` | `cargo clippy` | `cargo test` |
| `pyproject.toml` | — | `ruff check` | `pytest` |
| `Makefile` | `make` | `make lint` | `make test` |

package.json의 scripts에서 정확한 명령 추출. 빌드 도구 없으면 해당 단계 스킵.
