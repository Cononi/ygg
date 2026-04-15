---
name: ygg-qa
description: "Verify implementation. Run build/test/lint/typecheck and cross-check spec requirements with evidence-based pass/fail report. Triggered by /ygg:qa command."
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

Evidence-based verification. No guessing — prove with actual command output.

## Workflow

0. **Local LLM check** — `Bash: ygg llm status --json`. If `active !== null`, delegate build/test/lint log summarization (step 4 evidence synthesis) via `ygg llm summarize --input <log>`. Code fixes remain on Claude. On non-zero exit report and stop — see ygg-core Local LLM Delegation section.
1. **Find active topic** — locate stage=`add` topic in INDEX.md (see ygg-core)
2. **Read verification documents** — tasks.md (verification section), specs/, design.md
3. **Run verification**:
   - **Build** — auto-detect project build tool and run
   - **Lint & Typecheck** — record warning/error counts
   - **Tests** — run tests, record pass/fail counts
   - **Spec Cross-check** — verify specs/ requirements against code (pass/fail/partial)
   - **Tasks Check** — confirm all tasks.md items are complete
4. **Evidence Report** — ✅/❌ per step + actual output excerpts
5. **Handle results**:
   - **All Pass**: check tasks.md → mark topic complete → move it from active to archive immediately → update INDEX.md
   - **Failures**: list failures + suggest fixes → AskUserQuestion: "Fix and re-verify (Recommended)" / "Return to implementation" / "Cancel"

## Stage Responsibility

- `ygg-qa` is the final proof stage. It must not pass work based on guesses or document review alone; it has to use real command output.
- Once this stage passes, the topic is no longer active and must be completed and moved into `ygg/change/archive/`.
- That means `ygg-qa` owns both verification and final workflow closure through archive handling.
- When archiving, use the shared archive path (`ygg archive <topic>` or the same API path) so INDEX and `projectVersion` are updated together.

## Build Tool Detection

| File | Build | Lint | Test |
|------|-------|------|------|
| `package.json` | `pnpm build` | `pnpm lint` | `pnpm test` |
| `Cargo.toml` | `cargo build` | `cargo clippy` | `cargo test` |
| `pyproject.toml` | — | `ruff check` | `pytest` |
| `Makefile` | `make` | `make lint` | `make test` |

Extract exact commands from package.json scripts. Skip step if no build tool found.
