---
name: ygg-qa
description: "구현 결과 검증. 빌드/테스트/린트/타입체크 실행 후 스펙 요구사항 대비 증거 기반 pass/fail 리포트. /ygg:qa 커맨드로 실행."
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
   - **All Pass**: tasks.md 체크 → topic 완료 처리 → active에서 즉시 archive로 이동 → INDEX.md 업데이트
   - **Failures**: 실패 목록 + 수정 제안 → AskUserQuestion: "수정 후 재검증 (Recommended)" / "구현으로 돌아가기" / "Cancel"

## Stage Responsibility

- `ygg-qa`는 최종 증명 단계다. 추정이나 문서 확인만으로 통과시키지 않고 실제 실행 결과로 증명해야 한다.
- 이 단계가 통과하면 토픽은 더 이상 active가 아니며, 반드시 완료 처리 후 `ygg/change/archive/`로 이동해야 한다.
- 따라서 `ygg-qa`는 검증 역할뿐 아니라 워크플로우 종료와 archive 정리 책임도 가진다.
- archive 처리 시에는 공용 archive 경로(`ygg archive <topic>` 또는 동일 API)를 사용해 INDEX와 `projectVersion`까지 함께 갱신해야 한다.

## Build Tool Detection

| File | Build | Lint | Test |
|------|-------|------|------|
| `package.json` | `pnpm build` | `pnpm lint` | `pnpm test` |
| `Cargo.toml` | `cargo build` | `cargo clippy` | `cargo test` |
| `pyproject.toml` | — | `ruff check` | `pytest` |
| `Makefile` | `make` | `make lint` | `make test` |

package.json의 scripts에서 정확한 명령 추출. 빌드 도구 없으면 해당 단계 스킵.
