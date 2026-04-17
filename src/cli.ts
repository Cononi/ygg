import { Command } from 'commander'

import { runAdd } from './commands/add.js'
import { runArchive } from './commands/archive.js'
import { runCreate } from './commands/create.js'
import { runDashboard, runDashboardAdd, runDashboardPort, runDashboardRemove } from './commands/dashboard.js'
import { runInit } from './commands/init.js'
import { runLang } from './commands/lang.js'
import { runLlm, runLlmCode, runLlmScore, runLlmStatus, runLlmSummarize, runLlmWrite } from './commands/llm.js'
import { runNext } from './commands/next.js'
import { runQa } from './commands/qa.js'
import { runUpdate } from './commands/update.js'
import { runValidate } from './commands/validate.js'
import { isYggPointAutoModeEnabled } from './core/ygg-point.js'
import {
  SUPPORTED_TARGETS,
  readConfigYggPointAutoMode,
  type SupportedTarget,
  writeConfigYggPointAutoMode,
} from './i18n/config.js'
import { arrowKeySelect, promptInput } from './utils/interactive.js'
import { logger, setLogLevel } from './utils/logger.js'
import { resolveDashboardProjectRoot } from './utils/project-root.js'

const program = new Command()

async function promptAutoModeSelection(): Promise<'on' | 'off' | null> {
  const options = [
    { value: 'on', label: '1. on (Recommended) — 자동 검증 가능한 항목은 create에서 내부 반영' },
    { value: 'off', label: '2. off — create에서 모든 확인 포인트를 대화형 질문으로 진행' },
  ] as const

  if (process.stdin.isTTY && process.stdout.isTTY) {
    logger.info('YGG Point auto-mode를 선택하세요 (↑↓ 이동, Enter 선택, q 취소):')
    const selected = await arrowKeySelect(options.map((option) => ({ ...option })))
    return selected === 'on' || selected === 'off' ? selected : null
  }

  const raw = await promptInput([
    'YGG Point auto-mode를 선택하세요.',
    ...options.map((option) => option.label),
    '번호 또는 on/off 입력: ',
  ].join('\n'))

  if (raw === '1' || raw === 'on') return 'on'
  if (raw === '2' || raw === 'off') return 'off'
  return null
}

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
  .description('여러 AI 작업 환경에서 사용할 ygg 워크플로우 파일을 생성')
  .version('0.1.0')
  .option('-v, --verbose', '상세 로그 출력')
  .option('-q, --quiet', '에러만 출력')
  .hook('preAction', (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals<{ verbose?: boolean; quiet?: boolean }>()
    if (opts.verbose) setLogLevel('verbose')
    else if (opts.quiet) setLogLevel('quiet')
  })

program
  .command('create [description...]')
  .description('새 change topic proposal 생성 + YGG Point 질문 루프 실행')
  .action(async (descriptionParts?: string[]) => {
    try {
      await runCreate(process.cwd(), {
        description: descriptionParts?.join(' ').trim(),
      })
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    }
  })

program
  .command('next')
  .description('활성 create topic을 설계/스펙/작업 문서로 확장 + next-stage YGG Point 실행')
  .action(async () => {
    try {
      await runNext(process.cwd())
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    }
  })

program
  .command('add')
  .description('활성 next/add topic을 구현 단계로 올리고 daily log를 기록')
  .action(async () => {
    try {
      await runAdd(process.cwd())
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    }
  })

program
  .command('qa')
  .description('활성 add topic을 build/lint/typecheck/test로 검증하고 통과 시 archive')
  .action(async () => {
    try {
      await runQa(process.cwd())
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    }
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
  .description('ygg 관리 파일을 최신 템플릿으로 갱신 (지원 대상 entry 포함)')
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
  .description('생성된 파일이 대상 워크플로우 규약에 맞는지 검증')
  .option('--target <path>', '검증 대상 디렉토리', '.claude')
  .action(async (options: { target?: string }) => {
    await runValidate(process.cwd(), options)
  })

const pointCmd = program
  .command('point')
  .description('YGG Point 설정과 상태 관리')

pointCmd
  .command('auto-mode [mode]')
  .description('YGG Point auto-mode 설정/조회 (create 단계에서만 적용, 인자 없으면 대화형 선택)')
  .action(async (mode?: string) => {
    try {
      if (!mode) {
        const currentMode = await readConfigYggPointAutoMode(process.cwd())
        if (!currentMode) {
          const selected = await promptAutoModeSelection()
          if (!selected) {
            throw new Error('auto-mode selection cancelled')
          }
          await writeConfigYggPointAutoMode(process.cwd(), selected)
          logger.success(`YGG Point auto mode set to ${selected}`)
          return
        }

        const enabled = isYggPointAutoModeEnabled(currentMode)
        logger.info(`YGG Point auto mode: ${enabled ? 'on' : 'off'}`)
        logger.info(enabled
          ? 'create 단계에서 자동 검증 가능한 항목을 먼저 내부 반영합니다.'
          : 'create 단계에서 모든 확인 포인트를 한 번에 하나씩 질문합니다.')
        return
      }

      if (mode !== 'on' && mode !== 'off') {
        throw new Error('auto-mode must be one of: on, off')
      }

      await writeConfigYggPointAutoMode(process.cwd(), mode)
      logger.success(`YGG Point auto mode set to ${mode}`)
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    }
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
    await runDashboard(resolveDashboardProjectRoot(), { port, open: options.open })
  })

dashboardCmd
  .command('port [number]')
  .description('dashboard 기본 포트 설정/조회 (ygg/config.yml에 저장)')
  .action(async (portArg?: string) => {
    await runDashboardPort(resolveDashboardProjectRoot(), portArg)
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
  .description('다중 AI 작업에 사용할 로컬 보조 모델 설정 — 선택/등록/Off (대화형 메뉴)')
  .action(async () => {
    await runLlm(process.cwd())
  })

llmCmd
  .command('code')
  .description('선택된 로컬 보조 모델로 코드 초안 생성 → stdout')
  .requiredOption('--context <path>', '컨텍스트 파일 경로 (design.md, spec.md 등)')
  .requiredOption('--task <string>', '구현할 태스크 설명')
  .action(async (options: { context: string; task: string }) => {
    await runLlmCode(process.cwd(), options)
  })

llmCmd
  .command('score')
  .description('선택된 보조 모델로 입력 문서를 차원별 채점 → stdout JSON')
  .requiredOption('--dimensions <path>', '채점 차원 JSON 파일 경로')
  .requiredOption('--input <path>', '채점 대상 입력 파일 경로')
  .action(async (options: { dimensions: string; input: string }) => {
    await runLlmScore(process.cwd(), options)
  })

llmCmd
  .command('write')
  .description('선택된 보조 모델로 workflow 문서 초안 생성 → stdout')
  .requiredOption('--type <type>', '문서 종류 (proposal|design|spec|tasks)')
  .requiredOption('--input <path>', '문서 생성 입력 파일 경로')
  .action(async (options: { type: 'proposal' | 'design' | 'spec' | 'tasks'; input: string }) => {
    await runLlmWrite(process.cwd(), options)
  })

llmCmd
  .command('summarize')
  .description('선택된 보조 모델로 검증 로그 요약 → stdout')
  .requiredOption('--input <path>', '요약 대상 로그 파일 경로')
  .action(async (options: { input: string }) => {
    await runLlmSummarize(process.cwd(), options)
  })

llmCmd
  .command('status')
  .description('현재 다중 AI 보조 모델 설정 + 로컬 LLM 연결 상태 조회')
  .option('--json', 'JSON 형식으로 출력')
  .action(async (options: { json?: boolean }) => {
    await runLlmStatus(process.cwd(), options)
  })

program.parse()
