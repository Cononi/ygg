import { Command } from 'commander'

import { runArchive } from './commands/archive.js'
import { runDashboard, runDashboardAdd, runDashboardPort, runDashboardRemove } from './commands/dashboard.js'
import { runInit } from './commands/init.js'
import { runLang } from './commands/lang.js'
import { runLlm, runLlmCode, runLlmStatus } from './commands/llm.js'
import { runUpdate } from './commands/update.js'
import { runValidate } from './commands/validate.js'
import { SUPPORTED_TARGETS, type SupportedTarget } from './i18n/config.js'
import { logger, setLogLevel } from './utils/logger.js'

const program = new Command()

function parseTargetsOption(raw?: string): SupportedTarget[] | undefined {
  if (!raw) return undefined

  const parsed = raw
    .split(',')
    .map(part => part.trim())
    .filter((part): part is SupportedTarget =>
      (SUPPORTED_TARGETS as readonly string[]).includes(part),
    )

  return parsed.length > 0 ? Array.from(new Set(parsed)) : undefined
}

program
  .name('ygg')
  .description('Claude Code와 Codex에서 사용할 ygg 워크플로우 파일을 생성')
  .version('0.1.0')
  .option('-v, --verbose', '상세 로그 출력')
  .option('-q, --quiet', '에러만 출력')
  .hook('preAction', (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals<{ verbose?: boolean; quiet?: boolean }>()
    if (opts.verbose) setLogLevel('verbose')
    else if (opts.quiet) setLogLevel('quiet')
  })

program
  .command('init')
  .description('인터랙티브하게 대상 환경을 선택해 ygg 워크플로우 파일 생성')
  .option('--skip-claude', 'Claude Code 디렉토리 구조 생성 건너뛰기')
  .option('--targets <targets>', `생성 대상 환경 (${SUPPORTED_TARGETS.join(',')}, comma-separated)`)
  .action(async (options: { skipClaude?: boolean; targets?: string }) => {
    await runInit(process.cwd(), {
      skipClaude: options.skipClaude,
      targets: parseTargetsOption(options.targets),
    })
  })

program
  .command('update')
  .description('ygg 관리 파일을 최신 템플릿으로 갱신 (Claude/Codex entry 포함)')
  .action(async () => {
    try {
      await runUpdate(process.cwd())
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    }
  })

program
  .command('archive <topic>')
  .description('활성 change topic을 archive로 이동하고 projectVersion을 자동 증가')
  .action(async (topic: string) => {
    try {
      await runArchive(process.cwd(), topic)
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    }
  })

program
  .command('lang')
  .description('사용 언어 설정 (ko/en) — 초기화된 프로젝트에서 즉시 적용')
  .action(async () => {
    await runLang(process.cwd())
  })

program
  .command('validate')
  .description('생성된 파일이 Claude Code 규약에 맞는지 검증')
  .option('--target <path>', '검증 대상 디렉토리', '.claude')
  .action(async (options: { target?: string }) => {
    await runValidate(process.cwd(), options)
  })

const dashboardCmd = program
  .command('dashboard')
  .description('ygg 프로젝트 관리 웹 대시보드')

dashboardCmd
  .command('serve', { isDefault: true })
  .description('대시보드 서버 시작 (기본 커맨드)')
  .option('-p, --port <number>', '포트 번호 (기본값: config.yml → 4242)')
  .option('--no-open', '브라우저 자동 열기 비활성화')
  .action(async (options: { port?: string; open: boolean }) => {
    const port = options.port ? parseInt(options.port, 10) : undefined
    await runDashboard(process.cwd(), { port, open: options.open })
  })

dashboardCmd
  .command('port [number]')
  .description('dashboard 기본 포트 설정/조회 (ygg/config.yml에 저장)')
  .action(async (portArg?: string) => {
    await runDashboardPort(process.cwd(), portArg)
  })

dashboardCmd
  .command('add <path>')
  .description('registry에 기존 프로젝트 추가')
  .action(async (projectPath: string) => {
    await runDashboardAdd(projectPath)
  })

dashboardCmd
  .command('remove <path>')
  .description('registry에서 프로젝트 제거')
  .action(async (projectPath: string) => {
    await runDashboardRemove(projectPath)
  })

const llmCmd = program
  .command('llm')
  .description('Ollama LLM 설정 — 모델 선택/등록/Off (대화형 메뉴)')
  .action(async () => {
    await runLlm(process.cwd())
  })

llmCmd
  .command('code')
  .description('Ollama로 코드 초안 생성 → stdout')
  .requiredOption('--context <path>', '컨텍스트 파일 경로 (design.md, spec.md 등)')
  .requiredOption('--task <string>', '구현할 태스크 설명')
  .action(async (options: { context: string; task: string }) => {
    await runLlmCode(process.cwd(), options)
  })

llmCmd
  .command('status')
  .description('현재 LLM 설정 + Ollama 연결 상태 조회')
  .option('--json', 'JSON 형식으로 출력')
  .action(async (options: { json?: boolean }) => {
    await runLlmStatus(process.cwd(), options)
  })

program.parse()
