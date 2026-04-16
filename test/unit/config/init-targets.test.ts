import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'

import {
  readConfigYggPointAutoMode,
  readConfigProjectVersion,
  readConfigTargetNames,
  readConfigTargets,
  writeConfigProjectVersion,
  writeConfigTargets,
  writeConfigYggPointAutoMode,
} from '../../../src/i18n/config.js'

let projectRoot: string

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'ygg-targets-test-'))
})

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true })
})

describe('config targets', () => {
  it('writes and reads selected targets', async () => {
    await writeConfigTargets(projectRoot, ['claude', 'codex'])
    await expect(readConfigTargets(projectRoot)).resolves.toEqual(['claude', 'codex'])
  })

  it('preserves yaml structure as targets array', async () => {
    await writeConfigTargets(projectRoot, ['codex'])
    const raw = parseYaml(await readFile(join(projectRoot, 'ygg', 'config.yml'), 'utf-8')) as Record<string, unknown>
    expect(raw['targets']).toEqual(['codex'])
  })

  it('writes and reads projectVersion while preserving other fields', async () => {
    await writeConfigTargets(projectRoot, ['claude', 'codex'])
    await writeConfigProjectVersion(projectRoot, '0.0.3')

    await expect(readConfigProjectVersion(projectRoot)).resolves.toBe('0.0.3')

    const raw = parseYaml(await readFile(join(projectRoot, 'ygg', 'config.yml'), 'utf-8')) as Record<string, unknown>
    expect(raw['targets']).toEqual(['claude', 'codex'])
    expect(raw['projectVersion']).toBe('0.0.3')
  })

  it('writes and reads yggPoint.autoMode while preserving other fields', async () => {
    await writeConfigTargets(projectRoot, ['claude', 'codex'])
    await writeConfigProjectVersion(projectRoot, '0.0.3')
    await writeConfigYggPointAutoMode(projectRoot, 'on')

    await expect(readConfigYggPointAutoMode(projectRoot)).resolves.toBe('on')

    const raw = parseYaml(await readFile(join(projectRoot, 'ygg', 'config.yml'), 'utf-8')) as Record<string, unknown>
    expect(raw['targets']).toEqual(['claude', 'codex'])
    expect(raw['projectVersion']).toBe('0.0.3')
    expect(raw['yggPoint']).toEqual({ autoMode: 'on' })
  })

  it('keeps raw target names for future runtimes while filtering supported targets', async () => {
    await mkdir(join(projectRoot, 'ygg'), { recursive: true })
    await writeFile(
      join(projectRoot, 'ygg', 'config.yml'),
      ['targets:', '  - claude', '  - codex', '  - gemini', ''].join('\n'),
      'utf-8',
    )

    await expect(readConfigTargetNames(projectRoot)).resolves.toEqual(['claude', 'codex', 'gemini'])
    await expect(readConfigTargets(projectRoot)).resolves.toEqual(['claude', 'codex'])
  })

  it('ignores unsupported yggPoint.autoMode values', async () => {
    await mkdir(join(projectRoot, 'ygg'), { recursive: true })
    await writeFile(
      join(projectRoot, 'ygg', 'config.yml'),
      ['yggPoint:', '  autoMode: auto', ''].join('\n'),
      'utf-8',
    )

    await expect(readConfigYggPointAutoMode(projectRoot)).resolves.toBeUndefined()
  })
})
