import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

import { fileExists } from '../utils/file-writer.js'
import { logger } from '../utils/logger.js'

const CONFIG_FILE = 'ygg/config.yml'

export interface LlmConfig {
  active: string | null
  baseUrl: string
  models: string[]
}

export function getDefaultLlmConfig(): LlmConfig {
  return {
    active: null,
    baseUrl: 'http://localhost:1234',
    models: ['Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit'],
  }
}

/**
 * ygg/config.yml의 llm 섹션을 읽어 기본값과 병합한다.
 * 파일이 없거나 섹션이 비면 기본값(LM Studio localhost:1234)을 반환한다.
 * localLlm 섹션이 존재하면 자동으로 마이그레이션한다.
 */
export async function readLlmConfig(projectRoot: string): Promise<LlmConfig> {
  const configPath = join(projectRoot, CONFIG_FILE)
  const defaults = getDefaultLlmConfig()

  if (!(await fileExists(configPath))) return defaults

  let raw: Record<string, unknown>
  try {
    const content = await readFile(configPath, 'utf-8')
    const parsed = parseYaml(content) as Record<string, unknown> | null
    raw = parsed ?? {}
  } catch {
    return defaults
  }

  if (typeof raw['localLlm'] === 'object' && raw['localLlm'] !== null) {
    await migrateLocalLlmConfig(projectRoot)
    const migrated = await readFile(configPath, 'utf-8')
    const reparsed = parseYaml(migrated) as Record<string, unknown> | null
    raw = reparsed ?? {}
  }

  const section = raw['llm']
  if (typeof section !== 'object' || section === null) return defaults

  const s = section as Record<string, unknown>
  return {
    active: typeof s['active'] === 'string' ? s['active'] : null,
    baseUrl: typeof s['baseUrl'] === 'string' ? s['baseUrl'] : defaults.baseUrl,
    models: Array.isArray(s['models']) ? (s['models'] as unknown[]).filter((m): m is string => typeof m === 'string') : [],
  }
}

/**
 * ygg/config.yml의 llm 섹션만 업데이트한다. 다른 섹션은 보존한다.
 */
export async function writeLlmConfig(projectRoot: string, config: LlmConfig): Promise<void> {
  const configPath = join(projectRoot, CONFIG_FILE)
  let existing: Record<string, unknown> = {}

  if (await fileExists(configPath)) {
    try {
      const content = await readFile(configPath, 'utf-8')
      const parsed = parseYaml(content) as Record<string, unknown> | null
      if (parsed) existing = parsed
    } catch {
      // 파싱 실패 시 빈 객체로 시작
    }
  }

  existing['llm'] = {
    active: config.active,
    baseUrl: config.baseUrl,
    models: config.models,
  }

  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, stringifyYaml(existing), 'utf-8')
}

/**
 * ygg/config.yml의 localLlm 섹션을 llm 섹션으로 마이그레이션한다.
 * 변환 전 ygg/config.yml.bak을 백업으로 생성한다.
 * @returns 마이그레이션이 수행되었으면 true, localLlm 없으면 false
 */
export async function migrateLocalLlmConfig(projectRoot: string): Promise<boolean> {
  const configPath = join(projectRoot, CONFIG_FILE)
  const backupPath = `${configPath}.bak`

  if (!(await fileExists(configPath))) return false

  let raw: Record<string, unknown>
  try {
    const content = await readFile(configPath, 'utf-8')
    const parsed = parseYaml(content) as Record<string, unknown> | null
    raw = parsed ?? {}
  } catch {
    return false
  }

  if (typeof raw['localLlm'] !== 'object' || raw['localLlm'] === null) return false

  const localLlm = raw['localLlm'] as Record<string, unknown>

  await copyFile(configPath, backupPath)

  const enabled = localLlm['enabled'] === true
  const model = typeof localLlm['model'] === 'string' ? localLlm['model'] : null
  const defaults = getDefaultLlmConfig()

  const existingLlm = typeof raw['llm'] === 'object' && raw['llm'] !== null
    ? (raw['llm'] as Record<string, unknown>)
    : {}

  raw['llm'] = {
    active: enabled && model ? model : null,
    baseUrl: typeof existingLlm['baseUrl'] === 'string' ? existingLlm['baseUrl'] : defaults.baseUrl,
    models: Array.isArray(existingLlm['models'])
      ? existingLlm['models']
      : (enabled && model ? [model] : []),
  }

  delete raw['localLlm']

  await writeFile(configPath, stringifyYaml(raw), 'utf-8')
  logger.warn('localLlm 설정을 llm 섹션으로 마이그레이션했습니다. 백업: ygg/config.yml.bak')

  return true
}
