import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

import {
  getDefaultLlmConfig,
  readLlmConfig,
  writeLlmConfig,
  migrateLocalLlmConfig,
} from '../../../src/config/llm.js'

let projectRoot: string

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'ygg-llm-test-'))
})

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true })
})

async function writeYaml(obj: Record<string, unknown>): Promise<void> {
  const path = join(projectRoot, 'ygg', 'config.yml')
  await mkdir(join(projectRoot, 'ygg'), { recursive: true })
  await writeFile(path, stringifyYaml(obj), 'utf-8')
}

describe('getDefaultLlmConfig', () => {
  it('active null + LM Studio baseUrl + Qwen 기본 모델', () => {
    const cfg = getDefaultLlmConfig()
    expect(cfg.active).toBeNull()
    expect(cfg.baseUrl).toBe('http://localhost:1234')
    expect(cfg.models).toEqual(['Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit'])
  })
})

describe('readLlmConfig', () => {
  it('config.yml 없으면 기본값 반환', async () => {
    const cfg = await readLlmConfig(projectRoot)
    expect(cfg).toEqual(getDefaultLlmConfig())
  })

  it('llm 섹션 없으면 기본값 반환', async () => {
    await writeYaml({ lang: 'ko' })
    const cfg = await readLlmConfig(projectRoot)
    expect(cfg.active).toBeNull()
    expect(cfg.models).toEqual(['Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit'])
  })

  it('active 모델명 정확히 읽음', async () => {
    await writeYaml({
      llm: {
        active: 'llama3.2',
        baseUrl: 'http://localhost:1234',
        models: ['llama3.2', 'mistral'],
      },
    })
    const cfg = await readLlmConfig(projectRoot)
    expect(cfg.active).toBe('llama3.2')
    expect(cfg.models).toEqual(['llama3.2', 'mistral'])
  })

  it('active null (Off 상태) 정확히 읽음', async () => {
    await writeYaml({ llm: { active: null, baseUrl: 'http://localhost:1234', models: [] } })
    const cfg = await readLlmConfig(projectRoot)
    expect(cfg.active).toBeNull()
  })

  it('일부 필드 누락 시 기본값 채움', async () => {
    await writeYaml({ llm: { active: 'llama3.2' } })
    const cfg = await readLlmConfig(projectRoot)
    expect(cfg.active).toBe('llama3.2')
    expect(cfg.baseUrl).toBe('http://localhost:1234')
    expect(cfg.models).toEqual([])
  })

  it('손상된 YAML이면 기본값 반환', async () => {
    const path = join(projectRoot, 'ygg', 'config.yml')
    await mkdir(join(projectRoot, 'ygg'), { recursive: true })
    await writeFile(path, ': not yaml :', 'utf-8')
    const cfg = await readLlmConfig(projectRoot)
    expect(cfg.active).toBeNull()
  })

  it('localLlm 섹션 있으면 자동 마이그레이션', async () => {
    await writeYaml({
      localLlm: {
        enabled: true,
        model: 'custom-model',
        endpoint: 'http://127.0.0.1:8080/v1',
        serverPort: 8080,
      },
    })
    const cfg = await readLlmConfig(projectRoot)
    expect(cfg.active).toBe('custom-model')
    // localLlm 섹션이 제거됐는지 확인
    const raw = parseYaml(await readFile(join(projectRoot, 'ygg', 'config.yml'), 'utf-8')) as Record<string, unknown>
    expect(raw['localLlm']).toBeUndefined()
  })
})

describe('writeLlmConfig', () => {
  it('config.yml 신규 생성', async () => {
    await writeLlmConfig(projectRoot, { active: 'llama3.2', baseUrl: 'http://localhost:1234', models: ['llama3.2'] })
    const path = join(projectRoot, 'ygg', 'config.yml')
    const parsed = parseYaml(await readFile(path, 'utf-8')) as Record<string, unknown>
    const section = parsed['llm'] as Record<string, unknown>
    expect(section['active']).toBe('llama3.2')
    expect(section['models']).toEqual(['llama3.2'])
  })

  it('기존 다른 섹션 보존', async () => {
    await writeYaml({ lang: 'en', dashboard: { port: 4000 } })
    await writeLlmConfig(projectRoot, { active: null, baseUrl: 'http://localhost:1234', models: [] })
    const parsed = parseYaml(
      await readFile(join(projectRoot, 'ygg', 'config.yml'), 'utf-8'),
    ) as Record<string, unknown>
    expect(parsed['lang']).toBe('en')
    expect((parsed['dashboard'] as Record<string, unknown>)['port']).toBe(4000)
  })

  it('round-trip: write → read', async () => {
    const cfg = { active: 'mistral', baseUrl: 'http://localhost:1234', models: ['mistral', 'llama3.2'] }
    await writeLlmConfig(projectRoot, cfg)
    const read = await readLlmConfig(projectRoot)
    expect(read.active).toBe(cfg.active)
    expect(read.models).toEqual(cfg.models)
  })
})

describe('migrateLocalLlmConfig', () => {
  it('localLlm 없으면 false 반환', async () => {
    await writeYaml({ lang: 'ko' })
    const result = await migrateLocalLlmConfig(projectRoot)
    expect(result).toBe(false)
  })

  it('config.yml 없으면 false 반환', async () => {
    const result = await migrateLocalLlmConfig(projectRoot)
    expect(result).toBe(false)
  })

  it('localLlm enabled=true → active=model', async () => {
    await writeYaml({ localLlm: { enabled: true, model: 'my-model', endpoint: 'http://127.0.0.1:8080/v1', serverPort: 8080 } })
    const result = await migrateLocalLlmConfig(projectRoot)
    expect(result).toBe(true)
    const cfg = await readLlmConfig(projectRoot)
    expect(cfg.active).toBe('my-model')
    expect(cfg.models).toContain('my-model')
  })

  it('localLlm enabled=false → active=null', async () => {
    await writeYaml({ localLlm: { enabled: false, model: 'my-model', endpoint: 'http://127.0.0.1:8080/v1', serverPort: 8080 } })
    await migrateLocalLlmConfig(projectRoot)
    const cfg = await readLlmConfig(projectRoot)
    expect(cfg.active).toBeNull()
  })

  it('.bak 백업 파일 생성', async () => {
    await writeYaml({ localLlm: { enabled: false, model: 'm', endpoint: 'e', serverPort: 8080 } })
    await migrateLocalLlmConfig(projectRoot)
    const backupExists = await readFile(join(projectRoot, 'ygg', 'config.yml.bak'), 'utf-8').then(() => true).catch(() => false)
    expect(backupExists).toBe(true)
  })

  it('localLlm 섹션 제거됨', async () => {
    await writeYaml({ localLlm: { enabled: true, model: 'm', endpoint: 'e', serverPort: 8080 }, lang: 'ko' })
    await migrateLocalLlmConfig(projectRoot)
    const raw = parseYaml(await readFile(join(projectRoot, 'ygg', 'config.yml'), 'utf-8')) as Record<string, unknown>
    expect(raw['localLlm']).toBeUndefined()
    expect(raw['lang']).toBe('ko') // 다른 섹션 보존
  })
})
