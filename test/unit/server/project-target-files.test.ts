import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('dashboard target-aware file sources', () => {
  let homeDir: string
  let projectRoot: string
  let previousHome: string | undefined

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T09:00:00+09:00'))

    previousHome = process.env.HOME
    homeDir = await mkdtemp(join(tmpdir(), 'ygg-home-'))
    projectRoot = await mkdtemp(join(tmpdir(), 'ygg-project-'))
    process.env.HOME = homeDir
    vi.resetModules()

    await mkdir(join(projectRoot, '.claude', 'skills', 'ygg-create'), { recursive: true })
    await mkdir(join(projectRoot, '.claude', 'commands', 'ygg'), { recursive: true })
    await mkdir(join(projectRoot, '.codex', 'skills', 'ygg-create'), { recursive: true })
    await mkdir(join(projectRoot, 'ygg'), { recursive: true })

    await writeFile(join(projectRoot, '.claude', 'skills', 'ygg-create', 'SKILL.md'), '# Claude Skill\n', 'utf-8')
    await writeFile(join(projectRoot, '.claude', 'commands', 'ygg', 'create.md'), '# Claude Command\n', 'utf-8')
    await writeFile(join(projectRoot, '.codex', 'skills', 'ygg-create', 'SKILL.md'), '# Codex Skill\n', 'utf-8')
    await writeFile(join(projectRoot, 'AGENTS.md'), '# Codex Agent Doc\n', 'utf-8')
    await writeFile(
      join(projectRoot, 'ygg', 'config.yml'),
      ['targets:', '  - claude', '  - codex', '  - custom-ai', 'projectVersion: 0.0.0', ''].join('\n'),
      'utf-8',
    )
    await mkdir(join(projectRoot, 'ygg', 'change', 'archive', 'topic-one'), { recursive: true })
    await mkdir(join(projectRoot, 'ygg', 'change', 'archive', 'topic-two'), { recursive: true })
    await writeFile(
      join(projectRoot, 'ygg', 'change', 'INDEX.md'),
      [
        '# Change Index',
        '',
        '### Archive',
        '| 토픽 | 설명 | 버전 | 최신 | 날짜 |',
        '|---|---|---|---|---|',
        '| [topic-one](./archive/topic-one/) | first release | v0.0.1 | - | 2026-04-14 |',
        '| [topic-two](./archive/topic-two/) | latest release | v0.0.2 | latest | 2026-04-15 |',
        '',
      ].join('\n'),
      'utf-8',
    )
  })

  afterEach(async () => {
    vi.useRealTimers()
    if (previousHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = previousHome
    }
    await rm(homeDir, { recursive: true, force: true })
    await rm(projectRoot, { recursive: true, force: true })
  })

  it('lists target-specific files and resolves codex agent docs', async () => {
    const { addProject } = await import('../../../src/server/registry.js')
    const { createServer } = await import('../../../src/server/index.js')

    const project = await addProject(projectRoot, '1.0.0')
    const app = await createServer()

    const projectRes = await app.inject({ method: 'GET', url: `/api/projects/${project.id}` })
    expect(projectRes.statusCode).toBe(200)

    const payload = projectRes.json() as {
      info: { latestReleaseVersion?: string; latestReleaseDate?: string }
      targets: Array<{
        target: string
        files: { skills: string[]; agents: string[]; commands: string[] }
      }>
    }

    expect(payload.info.latestReleaseVersion).toBe('v0.0.2')
    expect(payload.info.latestReleaseDate).toBe('2026-04-15')

    expect(payload.targets.map(target => target.target)).toEqual(['claude', 'codex', 'custom-ai'])
    expect(payload.targets.find(target => target.target === 'claude')?.files).toEqual({
      skills: ['ygg-create'],
      agents: [],
      commands: ['ygg/create'],
    })
    expect(payload.targets.find(target => target.target === 'codex')?.files).toEqual({
      skills: ['ygg-create'],
      agents: ['AGENTS'],
      commands: [],
    })
    expect(payload.targets.find(target => target.target === 'custom-ai')?.files).toEqual({
      skills: [],
      agents: [],
      commands: [],
    })

    const fileRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/files/codex/agents/AGENTS`,
    })
    expect(fileRes.statusCode).toBe(200)
    expect(fileRes.json()).toEqual({
      content: '# Codex Agent Doc\n',
      path: join(projectRoot, 'AGENTS.md'),
    })

    await app.close()
  })

  it('keeps project list available when one project has broken metadata', async () => {
    const brokenProjectRoot = await mkdtemp(join(tmpdir(), 'ygg-project-broken-'))

    try {
      await mkdir(join(brokenProjectRoot, 'ygg', 'change', 'broken-topic'), { recursive: true })
      await writeFile(
        join(brokenProjectRoot, 'ygg', 'config.yml'),
        ['targets:', '  - codex', 'projectVersion: 0.0.0', ''].join('\n'),
        'utf-8',
      )
      await writeFile(
        join(brokenProjectRoot, 'ygg', 'change', 'INDEX.md'),
        [
          '# Change Index',
          '',
          '| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |',
          '|---|---|---|---|---|---|',
          '| [broken-topic](./broken-topic/) | 🔄 진행중 | add | 0.95 | broken topic | 2026-04-15 |',
          '',
          '### Archive',
          '| 토픽 | 설명 | 버전 | 최신 | 날짜 |',
          '|---|---|---|---|---|',
          '| [missing-archive](./archive/missing-archive/) | orphan row | v0.0.1 | latest | 2026-04-15 |',
          '',
        ].join('\n'),
        'utf-8',
      )

      const { addProject } = await import('../../../src/server/registry.js')
      const { createServer } = await import('../../../src/server/index.js')

      await addProject(projectRoot, '1.0.0')
      await addProject(brokenProjectRoot, '1.0.0')
      const app = await createServer()

      const res = await app.inject({ method: 'GET', url: '/api/projects' })
      expect(res.statusCode).toBe(200)

      const payload = res.json() as {
        projects: Array<{ path: string; changeStatus: { total: number } }>
      }
      expect(payload.projects).toHaveLength(2)
      expect(payload.projects.some(project => project.path === brokenProjectRoot)).toBe(true)

      await app.close()
    } finally {
      await rm(brokenProjectRoot, { recursive: true, force: true })
    }
  })
})
