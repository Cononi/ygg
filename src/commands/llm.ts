import * as readline from 'node:readline'

import { readLlmConfig, writeLlmConfig } from '../config/llm.js'
import { LlmAdapterError } from '../llm/adapter.js'
import { LmStudioProvider, checkLmStudioHealth } from '../llm/lm-studio-provider.js'
import { fileExists } from '../utils/file-writer.js'
import { logger } from '../utils/logger.js'

export const EXIT_LLM_DISABLED = 2
export const EXIT_CONTEXT_NOT_FOUND = 10
export const EXIT_ADAPTER_ERROR = 12
export const EXIT_LLM_TIMEOUT = 8

// 테스트에서 LmStudioProvider 주입 가능하도록
export type ProviderFactory = (baseUrl: string, model: string) => LmStudioProvider
let injectedFactory: ProviderFactory | undefined

export function __setProviderFactoryForTests(factory: ProviderFactory | undefined): void {
  injectedFactory = factory
}

function makeProvider(baseUrl: string, model: string): LmStudioProvider {
  if (injectedFactory) return injectedFactory(baseUrl, model)
  return new LmStudioProvider({ baseUrl, model })
}

function handleAdapterError(e: unknown): void {
  if (e instanceof LlmAdapterError) {
    logger.error(`${e.code}: ${e.message}`)
    process.exitCode = e.code === 'LLM_TIMEOUT' ? EXIT_LLM_TIMEOUT : EXIT_ADAPTER_ERROR
    return
  }
  logger.error(`LLM error: ${e instanceof Error ? e.message : String(e)}`)
  process.exitCode = EXIT_ADAPTER_ERROR
}

// ─── Interactive menu ──────────────────────────────────────────────────────

/** ygg llm — 화살표 키 대화형 모델 선택/등록/Off 메뉴 */
export async function runLlm(projectRoot: string): Promise<void> {
  if (!process.stdin.isTTY) {
    logger.error('ygg llm requires an interactive terminal (stdin is not a TTY)')
    process.exitCode = 1
    return
  }

  const cfg = await readLlmConfig(projectRoot)

  const currentLabel = cfg.active ? `활성: ${cfg.active}` : 'Off'
  logger.info(`LM Studio 설정  |  현재 상태: ${currentLabel}`)
  logger.info('↑↓ 이동, Enter 선택, Ctrl+C 취소\n')

  type MenuOption = { label: string; value: string }
  const options: MenuOption[] = []

  for (const model of cfg.models) {
    const prefix = model === cfg.active ? '[활성] ' : '       '
    options.push({ label: `${prefix}${model}`, value: `model:${model}` })
  }
  options.push({ label: '       모델 추가 — 새 모델을 레지스트리에 등록', value: 'add' })
  options.push({ label: '       Off — Claude API만 사용', value: 'off' })

  const selected = await arrowKeySelect(options)
  if (!selected) {
    logger.error('취소되었습니다.')
    return
  }

  if (selected === 'off') {
    await writeLlmConfig(projectRoot, { ...cfg, active: null })
    logger.success('LM Studio 비활성화 — Claude API로 동작합니다')
    return
  }

  if (selected === 'add') {
    const modelName = await promptInput('등록할 LM Studio 모델명을 입력하세요: ')
    if (!modelName) {
      logger.error('취소되었습니다.')
      return
    }
    const models = cfg.models.includes(modelName) ? cfg.models : [...cfg.models, modelName]
    const activate = await confirmYN(`이 모델을 지금 활성화하시겠습니까? [Y/n] `)
    const active = activate ? modelName : cfg.active
    await writeLlmConfig(projectRoot, { ...cfg, models, active })
    logger.success(`레지스트리에 추가되었습니다: ${modelName}`)
    if (activate) {
      await verifyAndReportHealth(cfg.baseUrl, modelName)
    }
    return
  }

  if (selected.startsWith('model:')) {
    const model = selected.slice('model:'.length)
    const healthy = await verifyAndReportHealth(cfg.baseUrl, model)
    if (healthy) {
      await writeLlmConfig(projectRoot, { ...cfg, active: model })
      logger.success(`활성 모델: ${model}`)
      logger.success('ygg/config.yml 업데이트 완료')
    } else {
      const force = await confirmYN('LM Studio 연결 실패. 그래도 설정을 저장할까요? [y/N] ')
      if (force) {
        await writeLlmConfig(projectRoot, { ...cfg, active: model })
        logger.warn(`활성 모델로 설정했습니다 (연결 불가): ${model}`)
      }
    }
    return
  }
}

async function verifyAndReportHealth(baseUrl: string, model: string): Promise<boolean> {
  process.stdout.write(`LM Studio 연결 확인: ${baseUrl} ... `)
  const healthy = await checkLmStudioHealth(baseUrl)
  if (healthy) {
    process.stdout.write('✓\n')
  } else {
    process.stdout.write('✗\n')
    logger.warn(`LM Studio 서버에 연결할 수 없습니다. 'lms server start'를 실행하세요.`)
    logger.info(`  모델 로드: LM Studio 앱에서 ${model} 모델을 선택하고 서버를 시작하세요.`)
  }
  return healthy
}

// ─── Status ───────────────────────────────────────────────────────────────

export interface LlmStatusOptions {
  json?: boolean
}

/** ygg llm status [--json] */
export async function runLlmStatus(projectRoot: string, opts: LlmStatusOptions = {}): Promise<void> {
  const cfg = await readLlmConfig(projectRoot)
  const healthy = cfg.active !== null ? await checkLmStudioHealth(cfg.baseUrl) : false

  if (opts.json) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ active: cfg.active, baseUrl: cfg.baseUrl, models: cfg.models, healthy }))
    return
  }

  const status = cfg.active ? `활성 (${cfg.active})` : 'Off'
  logger.info(`LLM 상태: ${status}`)
  logger.info(`  baseUrl: ${cfg.baseUrl}`)
  logger.info(`  models:  ${cfg.models.length > 0 ? cfg.models.join(', ') : '(없음)'}`)
  if (cfg.active) logger.info(`  LM Studio 연결: ${healthy ? '✓' : '✗'}`)
}

// ─── Code generation ──────────────────────────────────────────────────────

export interface LlmCodeOptions {
  context: string
  task: string
}

/** ygg llm code --context <path> --task <description> */
export async function runLlmCode(projectRoot: string, options: LlmCodeOptions): Promise<void> {
  const cfg = await readLlmConfig(projectRoot)
  if (!cfg.active) {
    logger.error('LLM_DISABLED — `ygg llm`으로 모델을 먼저 활성화하세요')
    process.exitCode = EXIT_LLM_DISABLED
    return
  }

  if (!(await fileExists(options.context))) {
    logger.error(`Context file not found: ${options.context}`)
    process.exitCode = EXIT_CONTEXT_NOT_FOUND
    return
  }

  const contextContent = await readFileContent(options.context)

  const prompt = buildCodePrompt(contextContent, options.task)

  try {
    const provider = makeProvider(cfg.baseUrl, cfg.active)
    const result = await provider.complete(prompt, { maxTokens: 4096, temperature: 0.2 })
    // eslint-disable-next-line no-console
    console.log(result)
  } catch (e) {
    handleAdapterError(e)
  }
}

function buildCodePrompt(context: string, task: string): string {
  return `You are a TypeScript code generator. Given the following context and task, write the implementation.

## Context

${context}

## Task

${task}

## Rules

- TypeScript strict mode, no \`any\`
- Explicit return types on all functions
- Output code only, no explanation or markdown fences`
}

async function readFileContent(filePath: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  return readFile(filePath, 'utf-8')
}

// ─── Arrow key menu ───────────────────────────────────────────────────────

async function arrowKeySelect(
  options: Array<{ value: string; label: string }>,
): Promise<string | null> {
  if (options.length === 0) return null
  let index = 0

  const renderMenu = () => {
    process.stdout.write(`\x1B[${options.length}A\x1B[0J`)
    for (let i = 0; i < options.length; i++) {
      const marker = i === index ? '▶' : ' '
      const opt = options[i]
      if (opt) process.stdout.write(`  ${marker} ${opt.label}\n`)
    }
  }

  for (const opt of options) {
    process.stdout.write(`    ${opt.label}\n`)
  }
  renderMenu()

  return new Promise((resolve) => {
    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()

    const onData = (buf: Buffer) => {
      const b0 = buf[0]
      const b1 = buf[1]
      const b2 = buf[2]

      if (b0 === 0x03 || b0 === 0x71) { cleanup(); resolve(null); return }
      if (b0 === 0x0D || b0 === 0x0A) { cleanup(); resolve(options[index]?.value ?? null); return }
      if (b0 === 0x1B && b1 === 0x5B && b2 === 0x41) { index = (index - 1 + options.length) % options.length; renderMenu(); return }
      if (b0 === 0x1B && b1 === 0x5B && b2 === 0x42) { index = (index + 1) % options.length; renderMenu(); return }
    }

    const cleanup = () => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
    }

    stdin.on('data', onData)
  })
}

async function promptInput(question: string): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim() || null)
    })
    rl.on('close', () => resolve(null))
  })
}

async function confirmYN(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
    rl.on('close', () => resolve(false))
  })
}
