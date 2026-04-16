import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeConfigLang, writeConfigTargets } from '../../../src/i18n/config.js'

import {
  listTemplateAgents,
  listTemplateCommands,
  listTemplateScripts,
  listTemplateSkills,
  runInit,
} from '../../../src/commands/init.js'
import { runUpdate } from '../../../src/commands/update.js'
import * as registry from '../../../src/server/registry.js'

let projectRoot: string
const TEST_LANG = 'ko'

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'ygg-init-test-'))
  await writeConfigLang(projectRoot, TEST_LANG)
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  vi.spyOn(registry, 'addProject').mockResolvedValue({
    id: 'test-id',
    path: projectRoot,
    addedAt: '2026-04-14T00:00:00.000Z',
    yggVersion: '1.0.0',
  })
  vi.spyOn(registry, 'loadRegistry').mockResolvedValue({ version: 1, projects: [] })
  vi.spyOn(registry, 'saveRegistry').mockResolvedValue()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(projectRoot, { recursive: true, force: true })
})

describe('runInit', () => {
  it('creates shared docs plus every template-managed Claude and Codex asset', async () => {
    await runInit(projectRoot, { targets: ['claude', 'codex'] })

    const shared = await readFile(join(projectRoot, 'ygg', 'agent.md'), 'utf-8')
    const claude = await readFile(join(projectRoot, 'CLAUDE.md'), 'utf-8')
    const codex = await readFile(join(projectRoot, 'AGENTS.md'), 'utf-8')
    const [expectedCommands, expectedSkills, expectedAgents, expectedScripts] = await Promise.all([
      listTemplateCommands(TEST_LANG),
      listTemplateSkills(TEST_LANG),
      listTemplateAgents(TEST_LANG),
      listTemplateScripts(),
    ])
    const [actualCommands, actualSkills, actualAgents, actualScripts] = await Promise.all([
      listRelativeEntries(join(projectRoot, '.claude', 'commands', 'ygg')),
      listRelativeEntries(join(projectRoot, '.claude', 'skills')),
      listRelativeEntries(join(projectRoot, '.claude', 'agents')),
      listRelativeEntries(join(projectRoot, 'ygg', 'scripts')),
    ])

    expect(shared).toContain('ygg/change/')
    expect(claude).toContain('ygg/agent.md')
    expect(codex).toContain('ygg/agent.md')
    expect(actualCommands).toEqual(expectedCommands.map((entry) => `${entry}.md`))
    expect(actualSkills).toEqual(expectedSkills)
    expect(actualAgents).toEqual(expectedAgents)
    expect(actualScripts).toEqual(expectedScripts)
  })

  it('creates only codex files when codex target is selected', async () => {
    await runInit(projectRoot, { targets: ['codex'] })

    const codex = await readFile(join(projectRoot, 'AGENTS.md'), 'utf-8')
    const codexSkill = await readFile(join(projectRoot, '.codex', 'skills', 'ygg-create', 'SKILL.md'), 'utf-8')
    expect(codex).toContain('ygg/agent.md')
    expect(codex).toContain('## Codex Skills')
    expect(codex).toContain('.codex/skills/ygg-create/SKILL.md')
    expect(codex).toContain('expert-architect')
    expect(codex).toContain('ygg-prove.sh')
    expect(codexSkill).toContain('## Source Mapping')
    expect(codexSkill).toContain('## Workflow')
    expect(codexSkill).toContain('Guardrails')

    await expect(readFile(join(projectRoot, 'CLAUDE.md'), 'utf-8')).rejects.toThrow()
    await expect(readFile(join(projectRoot, '.claude', 'settings.json'), 'utf-8')).rejects.toThrow()
  })
})

describe('runUpdate', () => {
  it('refreshes shared agent docs when templates change target files', async () => {
    await runInit(projectRoot, { targets: ['claude', 'codex'] })
    await writeFile(join(projectRoot, 'CLAUDE.md'), 'stale claude doc\n', 'utf-8')
    await writeFile(join(projectRoot, 'AGENTS.md'), 'stale codex doc\n', 'utf-8')

    await runUpdate(projectRoot)

    const claude = await readFile(join(projectRoot, 'CLAUDE.md'), 'utf-8')
    const codex = await readFile(join(projectRoot, 'AGENTS.md'), 'utf-8')

    expect(claude).toContain('ygg/agent.md')
    expect(codex).toContain('ygg/agent.md')
  })

  it('updates codex-only projects without creating claude files', async () => {
    await runInit(projectRoot, { targets: ['codex'] })
    await writeFile(join(projectRoot, 'AGENTS.md'), 'stale codex doc\n', 'utf-8')
    await writeFile(join(projectRoot, '.codex', 'skills', 'ygg-create', 'SKILL.md'), 'stale codex skill\n', 'utf-8')

    await runUpdate(projectRoot)

    const codex = await readFile(join(projectRoot, 'AGENTS.md'), 'utf-8')
    const codexSkill = await readFile(join(projectRoot, '.codex', 'skills', 'ygg-create', 'SKILL.md'), 'utf-8')
    expect(codex).toContain('ygg/agent.md')
    expect(codex).toContain('## Codex Skills')
    expect(codexSkill).toContain('## Source Mapping')
    expect(codexSkill).toContain('## Workflow')
    await expect(readFile(join(projectRoot, 'CLAUDE.md'), 'utf-8')).rejects.toThrow()
    await expect(readFile(join(projectRoot, '.claude', 'settings.json'), 'utf-8')).rejects.toThrow()
  })

  it('restores every missing template-managed Claude asset during update', async () => {
    await runInit(projectRoot, { targets: ['claude', 'codex'] })
    await rm(join(projectRoot, '.claude', 'commands', 'ygg', 'point.md'))
    await rm(join(projectRoot, '.claude', 'agents', 'expert-security.md'))
    await rm(join(projectRoot, 'ygg', 'scripts', 'ygg-prove.sh'))
    await rm(join(projectRoot, '.claude', 'skills', 'ygg-create'), { recursive: true, force: true })

    await runUpdate(projectRoot)

    const [expectedCommands, expectedSkills, expectedAgents, expectedScripts] = await Promise.all([
      listTemplateCommands(TEST_LANG),
      listTemplateSkills(TEST_LANG),
      listTemplateAgents(TEST_LANG),
      listTemplateScripts(),
    ])
    const [actualCommands, actualSkills, actualAgents, actualScripts] = await Promise.all([
      listRelativeEntries(join(projectRoot, '.claude', 'commands', 'ygg')),
      listRelativeEntries(join(projectRoot, '.claude', 'skills')),
      listRelativeEntries(join(projectRoot, '.claude', 'agents')),
      listRelativeEntries(join(projectRoot, 'ygg', 'scripts')),
    ])

    expect(actualCommands).toEqual(expectedCommands.map((entry) => `${entry}.md`))
    expect(actualSkills).toEqual(expectedSkills)
    expect(actualAgents).toEqual(expectedAgents)
    expect(actualScripts).toEqual(expectedScripts)
  })

  it('removes claude outputs when claude is deselected in config', async () => {
    await runInit(projectRoot, { targets: ['claude', 'codex'] })
    await writeConfigTargets(projectRoot, ['codex'])

    await runUpdate(projectRoot)

    await expect(readFile(join(projectRoot, 'CLAUDE.md'), 'utf-8')).rejects.toThrow()
    const codex = await readFile(join(projectRoot, 'AGENTS.md'), 'utf-8')
    expect(codex).toContain('ygg/agent.md')
    await expect(readFile(join(projectRoot, '.claude', 'settings.json'), 'utf-8')).rejects.toThrow()
    const codexSkill = await readFile(join(projectRoot, '.codex', 'skills', 'ygg-next', 'SKILL.md'), 'utf-8')
    expect(codexSkill).toContain('## Workflow')
    expect(codexSkill).toContain('## Source Mapping')
  })

  it('removes codex output when codex is deselected in config', async () => {
    await runInit(projectRoot, { targets: ['claude', 'codex'] })
    await writeConfigTargets(projectRoot, ['claude'])

    await runUpdate(projectRoot)

    await expect(readFile(join(projectRoot, 'AGENTS.md'), 'utf-8')).rejects.toThrow()
    await expect(readFile(join(projectRoot, '.codex', 'skills', 'ygg-create', 'SKILL.md'), 'utf-8')).rejects.toThrow()
    const claude = await readFile(join(projectRoot, 'CLAUDE.md'), 'utf-8')
    expect(claude).toContain('ygg/agent.md')
    const settings = await readFile(join(projectRoot, '.claude', 'settings.json'), 'utf-8')
    expect(settings).toContain('hooks')
  })
})

async function listRelativeEntries(dir: string): Promise<string[]> {
  return (await readdir(dir)).sort()
}
