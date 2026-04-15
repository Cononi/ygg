import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('project change status summary', () => {
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

    await mkdir(join(projectRoot, 'ygg', 'change', 'topic-one'), { recursive: true })
    await mkdir(join(projectRoot, 'ygg', 'change', 'topic-two'), { recursive: true })
    await mkdir(join(projectRoot, 'ygg', 'change', 'archive', 'topic-three'), { recursive: true })
    await mkdir(join(projectRoot, 'ygg', 'change', 'archive', 'topic-four'), { recursive: true })
    await writeFile(
      join(projectRoot, 'ygg', 'config.yml'),
      ['targets:', '  - codex', 'projectVersion: 0.0.2', ''].join('\n'),
      'utf-8',
    )
    await writeFile(
      join(projectRoot, 'ygg', 'change', 'INDEX.md'),
      [
        '# Change Index',
        '',
        '| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |',
        '|---|---|---|---|---|---|',
        '| [topic-one](./topic-one/) | 🔄 진행중 | add | 0.95 | active topic one | 2026-04-15 |',
        '| [topic-two](./topic-two/) | ✅ 완료 | qa | 0.96 | active topic two | 2026-04-15 |',
        '',
        '### Archive',
        '| 토픽 | 설명 | 버전 | 최신 | 날짜 |',
        '|---|---|---|---|---|',
        '| [topic-three](./archive/topic-three/) | archived topic one | v0.0.1 | - | 2026-04-14 |',
        '| [topic-four](./archive/topic-four/) | archived topic two | v0.0.2 | latest | 2026-04-15 |',
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

  it('counts active topics separately from archived topics', async () => {
    const { addProject } = await import('../../../src/server/registry.js')
    const { createServer } = await import('../../../src/server/index.js')

    const project = await addProject(projectRoot, '1.0.0')
    const app = await createServer()

    const res = await app.inject({ method: 'GET', url: `/api/projects/${project.id}` })
    expect(res.statusCode).toBe(200)

    const payload = res.json() as {
      info: {
        changeStatus: {
          total: number
          inProgress: number
          done: number
        }
      }
    }

    expect(payload.info.changeStatus).toEqual({
      total: 4,
      inProgress: 2,
      done: 2,
    })

    await app.close()
  })
})
