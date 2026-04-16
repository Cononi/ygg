import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

import { fileExists } from '../utils/file-writer.js'
import type { YggPointAutoMode } from '../types/ygg-point.js'

const CONFIG_FILE = 'ygg/config.yml'
export const SUPPORTED_TARGETS = ['claude', 'codex'] as const
export type SupportedTarget = typeof SUPPORTED_TARGETS[number]
const SUPPORTED_YGG_POINT_AUTO_MODES = ['on', 'off'] as const

async function readConfig(projectRoot: string): Promise<Record<string, unknown>> {
  const configPath = join(projectRoot, CONFIG_FILE)

  if (!await fileExists(configPath)) {
    return {}
  }

  try {
    const content = await readFile(configPath, 'utf-8')
    return (parseYaml(content) as Record<string, unknown> | null) ?? {}
  } catch {
    return {}
  }
}

async function writeConfig(projectRoot: string, config: Record<string, unknown>): Promise<void> {
  const configPath = join(projectRoot, CONFIG_FILE)
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, stringifyYaml(config), 'utf-8')
}

/** ygg/config.yml에서 lang 필드를 읽는다 */
export async function readConfigLang(projectRoot: string): Promise<string | undefined> {
  const config = await readConfig(projectRoot)
  return typeof config['lang'] === 'string' ? config['lang'] : undefined
}

/** ygg/config.yml에서 dashboard.port 필드를 읽는다 */
export async function readConfigDashboardPort(projectRoot: string): Promise<number | undefined> {
  const config = await readConfig(projectRoot)
  if (typeof config['dashboard'] === 'object' && config['dashboard'] !== null) {
    const dashboard = config['dashboard'] as Record<string, unknown>
    if (typeof dashboard['port'] === 'number') {
      return dashboard['port']
    }
  }
  return undefined
}

/** ygg/config.yml에서 projectVersion 필드를 읽는다 */
export async function readConfigProjectVersion(projectRoot: string): Promise<string | undefined> {
  const config = await readConfig(projectRoot)
  return typeof config['projectVersion'] === 'string' ? config['projectVersion'] : undefined
}

/** ygg/config.yml에서 targets 필드를 읽는다 */
export async function readConfigTargets(projectRoot: string): Promise<SupportedTarget[] | undefined> {
  const rawTargets = await readConfigTargetNames(projectRoot)
  if (!Array.isArray(rawTargets)) {
    return undefined
  }

  const normalized = rawTargets.filter(
    (target): target is SupportedTarget =>
      typeof target === 'string' && (SUPPORTED_TARGETS as readonly string[]).includes(target),
  )

  if (normalized.length === 0) {
    return undefined
  }

  return Array.from(new Set(normalized))
}

/** ygg/config.yml에서 yggPoint.autoMode 필드를 읽는다 */
export async function readConfigYggPointAutoMode(projectRoot: string): Promise<YggPointAutoMode | undefined> {
  const config = await readConfig(projectRoot)
  if (typeof config['yggPoint'] !== 'object' || config['yggPoint'] === null) {
    return undefined
  }

  const yggPoint = config['yggPoint'] as Record<string, unknown>
  const autoMode = yggPoint['autoMode']
  if (
    typeof autoMode === 'string' &&
    (SUPPORTED_YGG_POINT_AUTO_MODES as readonly string[]).includes(autoMode)
  ) {
    return autoMode as YggPointAutoMode
  }
  return undefined
}

/** ygg/config.yml에서 targets 필드를 원본 문자열 배열로 읽는다 */
export async function readConfigTargetNames(projectRoot: string): Promise<string[] | undefined> {
  const config = await readConfig(projectRoot)
  const rawTargets = config['targets']
  if (!Array.isArray(rawTargets)) {
    return undefined
  }

  const normalized = rawTargets.filter((target): target is string => typeof target === 'string' && target.length > 0)
  if (normalized.length === 0) {
    return undefined
  }

  return Array.from(new Set(normalized))
}

/** ygg/config.yml에 dashboard.port 필드를 저장한다. 기존 필드는 보존. */
export async function writeConfigDashboardPort(projectRoot: string, port: number): Promise<void> {
  const config = await readConfig(projectRoot)

  const dashboard = (typeof config['dashboard'] === 'object' && config['dashboard'] !== null)
    ? { ...(config['dashboard'] as Record<string, unknown>) }
    : {}
  dashboard['port'] = port
  config['dashboard'] = dashboard

  await writeConfig(projectRoot, config)
}

/** ygg/config.yml에 projectVersion 필드를 저장한다. 기존 필드는 보존. */
export async function writeConfigProjectVersion(projectRoot: string, version: string): Promise<void> {
  const config = await readConfig(projectRoot)
  config['projectVersion'] = version
  await writeConfig(projectRoot, config)
}

/** ygg/config.yml에 lang 필드를 저장한다. 기존 필드는 보존. */
export async function writeConfigLang(projectRoot: string, lang: string): Promise<void> {
  const config = await readConfig(projectRoot)
  config['lang'] = lang
  await writeConfig(projectRoot, config)
}

/** ygg/config.yml에 targets 필드를 저장한다. 기존 필드는 보존. */
export async function writeConfigTargets(projectRoot: string, targets: SupportedTarget[]): Promise<void> {
  const config = await readConfig(projectRoot)
  config['targets'] = Array.from(new Set(targets))
  await writeConfig(projectRoot, config)
}

/** ygg/config.yml에 yggPoint.autoMode 필드를 저장한다. 기존 필드는 보존. */
export async function writeConfigYggPointAutoMode(projectRoot: string, autoMode: YggPointAutoMode): Promise<void> {
  const config = await readConfig(projectRoot)
  const yggPoint = (typeof config['yggPoint'] === 'object' && config['yggPoint'] !== null)
    ? { ...(config['yggPoint'] as Record<string, unknown>) }
    : {}
  yggPoint['autoMode'] = autoMode
  config['yggPoint'] = yggPoint
  await writeConfig(projectRoot, config)
}
