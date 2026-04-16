import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('project delete route', () => {
  let homeDir: string
  let projectRoot: string
  let previousHome: string | undefined

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T10:00:00+09:00'))

    previousHome = process.env.HOME
    homeDir = await mkdtemp(join(tmpdir(), 'ygg-home-'))
    projectRoot = await mkdtemp(join(tmpdir(), 'ygg-project-'))
    process.env.HOME = homeDir
    vi.resetModules()

    await mkdir(join(projectRoot, 'ygg', 'change', 'archive'), { recursive: true })
    await writeFile(
      join(projectRoot, 'ygg', 'config.yml'),
      ['targets:', '  - codex', 'projectVersion: 0.0.1', ''].join('\n'),
      'utf-8',
    )
    await writeFile(
      join(projectRoot, 'ygg', 'change', 'INDEX.md'),
      [
        '# Change Index',
        '',
        '| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |',
        '|---|---|---|---|---|---|',
        '',
        '### Archive',
        '| 토픽 | 설명 | 버전 | 최신 | 날짜 |',
        '|---|---|---|---|---|',
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

  it('removes only the registry entry and keeps the project directory intact', async () => {
    const { addProject } = await import('../../../src/server/registry.js')
    const { createServer } = await import('../../../src/server/index.js')

    const project = await addProject(projectRoot, '1.0.0')
    const app = await createServer()

    const res = await app.inject({ method: 'DELETE', url: `/api/projects/${project.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ success: true })

    const listRes = await app.inject({ method: 'GET', url: '/api/projects' })
    expect(listRes.statusCode).toBe(200)
    expect(listRes.json()).toEqual({
      categories: ['home'],
      projects: [],
      groupedProjects: [
        {
          category: 'home',
          projects: [],
        },
      ],
    })

    await expect(access(projectRoot)).resolves.toBeUndefined()
    await app.close()
  })
})
