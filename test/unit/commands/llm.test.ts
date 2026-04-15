import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stringify as stringifyYaml } from 'yaml'

import { writeLlmConfig } from '../../../src/config/llm.js'
import {
  EXIT_ADAPTER_ERROR,
  EXIT_CONTEXT_NOT_FOUND,
  EXIT_LLM_DISABLED,
  EXIT_LLM_TIMEOUT,
  __setProviderFactoryForTests,
  runLlmCode,
  runLlmStatus,
} from '../../../src/commands/llm.js'
import { LlmAdapterError } from '../../../src/llm/adapter.js'
import type { LmStudioProvider } from '../../../src/llm/lm-studio-provider.js'

let projectRoot: string
let stdoutSpy: ReturnType<typeof vi.spyOn>

function mockProvider(response: string | Error): LmStudioProvider {
  return {
    complete: vi.fn(async () => {
      if (response instanceof Error) throw response
      return response
    }),
  } as unknown as LmStudioProvider
}

async function writeConfig(obj: Record<string, unknown>): Promise<void> {
  const dir = join(projectRoot, 'ygg')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'config.yml'), stringifyYaml(obj), 'utf-8')
}

async function writeContextFile(content = 'design content'): Promise<string> {
  const path = join(projectRoot, 'design.md')
  await writeFile(path, content, 'utf-8')
  return path
}

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'ygg-llm-cmd-test-'))
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(async () => {
  __setProviderFactoryForTests(undefined)
  vi.restoreAllMocks()
  process.exitCode = undefined
  await rm(projectRoot, { recursive: true, force: true })
})

// ─── runLlmCode ──────────────────────────────────────────────────────────

describe('runLlmCode', () => {
  it('llm.active null → EXIT_LLM_DISABLED', async () => {
    await writeLlmConfig(projectRoot, { active: null, baseUrl: 'http://localhost:1234', models: [] })
    const contextPath = await writeContextFile()
    await runLlmCode(projectRoot, { context: contextPath, task: 'write something' })
    expect(process.exitCode).toBe(EXIT_LLM_DISABLED)
  })

  it('context 파일 없음 → EXIT_CONTEXT_NOT_FOUND', async () => {
    await writeLlmConfig(projectRoot, { active: 'llama3.2', baseUrl: 'http://localhost:1234', models: ['llama3.2'] })
    __setProviderFactoryForTests(() => mockProvider('code'))
    await runLlmCode(projectRoot, { context: join(projectRoot, 'nonexistent.md'), task: 'write something' })
    expect(process.exitCode).toBe(EXIT_CONTEXT_NOT_FOUND)
  })

  it('정상 실행 → console.log로 코드 출력', async () => {
    await writeLlmConfig(projectRoot, { active: 'llama3.2', baseUrl: 'http://localhost:1234', models: ['llama3.2'] })
    __setProviderFactoryForTests(() => mockProvider('const x = 1;'))
    const contextPath = await writeContextFile()
    await runLlmCode(projectRoot, { context: contextPath, task: 'write a const' })
    expect(process.exitCode).toBeUndefined()
    expect(vi.mocked(console.log)).toHaveBeenCalledWith('const x = 1;')
  })

  it('LlmAdapterError(LLM_TIMEOUT) → EXIT_LLM_TIMEOUT', async () => {
    await writeLlmConfig(projectRoot, { active: 'llama3.2', baseUrl: 'http://localhost:1234', models: ['llama3.2'] })
    __setProviderFactoryForTests(() => mockProvider(new LlmAdapterError('LLM_TIMEOUT', 'timed out')))
    const contextPath = await writeContextFile()
    await runLlmCode(projectRoot, { context: contextPath, task: 'write' })
    expect(process.exitCode).toBe(EXIT_LLM_TIMEOUT)
  })

  it('LlmAdapterError(LLM_NETWORK_ERROR) → EXIT_ADAPTER_ERROR', async () => {
    await writeLlmConfig(projectRoot, { active: 'llama3.2', baseUrl: 'http://localhost:1234', models: ['llama3.2'] })
    __setProviderFactoryForTests(() => mockProvider(new LlmAdapterError('LLM_NETWORK_ERROR', 'refused')))
    const contextPath = await writeContextFile()
    await runLlmCode(projectRoot, { context: contextPath, task: 'write' })
    expect(process.exitCode).toBe(EXIT_ADAPTER_ERROR)
  })

  it('context 내용이 프롬프트에 포함됨', async () => {
    await writeLlmConfig(projectRoot, { active: 'llama3.2', baseUrl: 'http://localhost:1234', models: ['llama3.2'] })
    const provider = mockProvider('result')
    __setProviderFactoryForTests(() => provider)
    const contextPath = await writeContextFile('MY_CONTEXT_CONTENT')
    await runLlmCode(projectRoot, { context: contextPath, task: 'MY_TASK' })
    const callArgs = vi.mocked(provider.complete).mock.calls[0]
    expect(callArgs?.[0]).toContain('MY_CONTEXT_CONTENT')
    expect(callArgs?.[0]).toContain('MY_TASK')
  })
})

// ─── runLlmStatus ────────────────────────────────────────────────────────

describe('runLlmStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('--json 플래그 → JSON stdout 출력', async () => {
    await writeLlmConfig(projectRoot, { active: 'llama3.2', baseUrl: 'http://localhost:1234', models: ['llama3.2'] })
    await runLlmStatus(projectRoot, { json: true })
    const logged = vi.mocked(console.log).mock.calls[0]?.[0] as string
    const parsed = JSON.parse(logged) as { active: string; healthy: boolean; models: string[] }
    expect(parsed.active).toBe('llama3.2')
    expect(typeof parsed.healthy).toBe('boolean')
    expect(parsed.models).toContain('llama3.2')
  })

  it('active null → healthy false', async () => {
    await writeLlmConfig(projectRoot, { active: null, baseUrl: 'http://localhost:1234', models: [] })
    await runLlmStatus(projectRoot, { json: true })
    const logged = vi.mocked(console.log).mock.calls[0]?.[0] as string
    const parsed = JSON.parse(logged) as { active: null; healthy: boolean }
    expect(parsed.active).toBeNull()
    expect(parsed.healthy).toBe(false)
  })
})
