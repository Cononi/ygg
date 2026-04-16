# @cono-ai/ygg 사용법

## 개요

`@cono-ai/ygg`는 Claude Code와 Codex 프로젝트에 ygg workflow 파일을 설치하고, `ygg/change/` 기반 change workflow를 운영하는 CLI 도구다.

현재 공식 흐름은 다음 네 단계다.

```text
create → next → add → qa
```

- `create`: proposal 정의
- `next`: design/spec/tasks 확정
- `add`: 구현
- `qa`: 검증 후 archive

## 설치

```bash
pnpm install
pnpm build
pnpm link --global
```

## 빠른 시작

```bash
ygg init
```

이후 Claude Code 또는 Codex에서 `ygg/change/` 문서를 기준으로 작업한다.

```bash
/ygg:create 사용자 인증 기능 추가
/ygg:next
/ygg:add
/ygg:qa
```

## 주요 CLI 명령

### `ygg init`

프로젝트를 ygg workflow용으로 초기화한다.

```bash
ygg init
ygg init --targets claude
ygg init --targets claude,codex
ygg init --skip-claude
```

초기화 결과에는 다음이 포함된다.

- `ygg/agent.md`
- `ygg/change/INDEX.md`
- `.claude/` 또는 `.codex/skills/`
- `CLAUDE.md`, `AGENTS.md`

### `ygg update`

현재 설정된 targets 기준으로 ygg 관리 파일을 최신 템플릿으로 갱신한다.

```bash
ygg update
```

### `ygg archive <topic>`

활성 change topic을 archive로 이동하고 `archiveType`에 따라 project version을 증가시킨다.
- `breaking` → major 증가
- `feat` → minor 증가
- `fix`, `docs`, `refactor`, `chore` → patch 증가

```bash
ygg archive my-topic
```

### `ygg lang`

문서/스킬 렌더링 언어를 전환한다.

```bash
ygg lang
```

### `ygg validate`

생성된 Claude output이 규약에 맞는지 검증한다.

```bash
ygg validate
ygg validate --target .claude
```

### `ygg dashboard`

프로젝트 관리용 웹 대시보드를 실행하거나 registry를 관리한다.

```bash
ygg dashboard
ygg dashboard serve --no-open
ygg dashboard port 4242
ygg dashboard add /path/to/project
ygg dashboard remove /path/to/project
```

### `ygg llm`

로컬 Ollama 기반 LLM 설정을 관리한다.

```bash
ygg llm
ygg llm status
ygg llm status --json
ygg llm code --context ygg/change/topic/design.md --task "구현 초안 생성"
```

## Workflow 구조

각 변경은 `ygg/change/{topic}/` 아래에 독립적으로 관리된다.

```text
ygg/change/{topic}/
├── proposal.md
├── ygg-point.json
├── design.md
├── specs/
├── tasks.md
└── YYYY-MM-DD.md
```

## Hook 시스템

`ygg init`은 Claude 환경에 다음 스크립트를 설치한다.

- `ygg-scope-check.sh`: 작업 범위 이탈 경고
- `ygg-track-change.sh`: 변경 파일 추적
- `ygg-progress-check.sh`: change 문서 갱신 알림
- `ygg-log-change.sh`: 변경 로그 기록
- `ygg-prove.sh`: 설치 무결성 검증

## 검증

시스템 설치와 프로젝트 상태는 다음으로 확인할 수 있다.

```bash
bash .claude/scripts/ygg-prove.sh
pnpm build
pnpm test
```

## 프로그래밍 API

Node.js 라이브러리로 일부 기능을 직접 사용할 수도 있다.

```ts
import {
  parseComponentSpec,
  buildSinglePlan,
  executeGenerate,
  validateOutput,
} from '@cono-ai/ygg'

const spec = await parseComponentSpec('specs/reviewer.agent.yml')
if (spec.ok) {
  const plan = await buildSinglePlan('specs/reviewer.agent.yml', process.cwd())
  if (plan.ok) {
    await executeGenerate(plan.value, {
      dryRun: false,
      force: true,
      interactive: false,
      projectRoot: process.cwd(),
    })
  }
}

await validateOutput('.claude')
```
