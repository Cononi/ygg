import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('archive metadata and latest tracking', () => {
  let homeDir: string
  let projectRoot: string
  let previousHome: string | undefined

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-14T09:00:00+09:00'))

    previousHome = process.env.HOME
    homeDir = await mkdtemp(join(tmpdir(), 'ygg-home-'))
    projectRoot = await mkdtemp(join(tmpdir(), 'ygg-project-'))
    process.env.HOME = homeDir
    vi.resetModules()

    await mkdir(join(projectRoot, 'ygg', 'change', 'topic-one'), { recursive: true })
    await mkdir(join(projectRoot, 'ygg', 'change', 'topic-two'), { recursive: true })

    await writeFile(
      join(projectRoot, 'ygg', 'config.yml'),
      ['targets:', '  - codex', 'projectVersion: 0.0.0', ''].join('\n'),
      'utf-8',
    )

    await writeFile(
      join(projectRoot, 'ygg', 'change', 'INDEX.md'),
      [
        '# Change Index',
        '',
        '| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |',
        '|---|---|---|---|---|---|',
        '| [topic-one](./topic-one/) | 🔄 진행중 | qa | 0.95 | first archived topic | 2026-04-14 |',
        '| [topic-two](./topic-two/) | 🔄 진행중 | qa | 0.96 | second archived topic | 2026-04-14 |',
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

  it('writes archive version/date metadata and keeps only one latest row', async () => {
    const { addProject } = await import('../../../src/server/registry.js')
    const { createServer } = await import('../../../src/server/index.js')

    const project = await addProject(projectRoot, '1.0.0')
    const app = await createServer()

    const firstArchive = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/changes/topic-one/archive`,
    })
    expect(firstArchive.statusCode).toBe(200)

    let changesRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/changes`,
    })
    expect(changesRes.statusCode).toBe(200)
    let payload = changesRes.json() as {
      archiveTopics: Array<{ topic: string; version?: string; latest?: string; date?: string }>
    }
    expect(payload.archiveTopics).toEqual([
      {
        topic: 'topic-one',
        description: 'first archived topic',
        version: 'v0.0.1',
        latest: 'latest',
        date: '2026-04-14',
      },
    ])

    expect(await readFile(join(projectRoot, 'ygg', 'config.yml'), 'utf-8')).toContain('projectVersion: 0.0.1')

    const secondArchive = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/changes/topic-two/archive`,
    })
    expect(secondArchive.statusCode).toBe(200)

    changesRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/changes`,
    })
    payload = changesRes.json() as {
      archiveTopics: Array<{ topic: string; version?: string; latest?: string; date?: string }>
    }

    expect(payload.archiveTopics).toEqual([
      {
        topic: 'topic-two',
        description: 'second archived topic',
        version: 'v0.0.2',
        latest: 'latest',
        date: '2026-04-14',
      },
      {
        topic: 'topic-one',
        description: 'first archived topic',
        version: 'v0.0.1',
        latest: '-',
        date: '2026-04-14',
      },
    ])

    const indexContent = await readFile(join(projectRoot, 'ygg', 'change', 'INDEX.md'), 'utf-8')
    expect(indexContent).toContain('| 토픽 | 설명 | 버전 | 최신 | 날짜 |')
    expect(indexContent).toContain('| [topic-one](./archive/topic-one/) | first archived topic | v0.0.1 | - | 2026-04-14 |')
    expect(indexContent).toContain('| [topic-two](./archive/topic-two/) | second archived topic | v0.0.2 | latest | 2026-04-14 |')
    expect(await readFile(join(projectRoot, 'ygg', 'config.yml'), 'utf-8')).toContain('projectVersion: 0.0.2')

    await app.close()
  })

  it('uses the shared archive command path to bump version and update index', async () => {
    const { runArchive } = await import('../../../src/commands/archive.js')

    await runArchive(projectRoot, 'topic-one')

    const indexContent = await readFile(join(projectRoot, 'ygg', 'change', 'INDEX.md'), 'utf-8')
    expect(indexContent).not.toContain('| [topic-one](./topic-one/) | 🔄 진행중 | qa | 0.95 | first archived topic |')
    expect(indexContent).toContain('| [topic-one](./archive/topic-one/) | first archived topic | v0.0.1 | latest | 2026-04-14 |')

    const configContent = await readFile(join(projectRoot, 'ygg', 'config.yml'), 'utf-8')
    expect(configContent).toContain('projectVersion: 0.0.1')
  })

  it('removes archive rows and folders when version metadata is missing', async () => {
    await mkdir(join(projectRoot, 'ygg', 'change', 'archive', 'broken-topic'), { recursive: true })
    await writeFile(
      join(projectRoot, 'ygg', 'change', 'INDEX.md'),
      [
        '# Change Index',
        '',
        '| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |',
        '|---|---|---|---|---|---|',
        '| [topic-one](./topic-one/) | 🔄 진행중 | qa | 0.95 | first archived topic | 2026-04-14 |',
        '',
        '### Archive',
        '| 토픽 | 설명 | 버전 | 최신 | 날짜 |',
        '|---|---|---|---|---|',
        '| [broken-topic](./archive/broken-topic/) | invalid archive | - | latest | 2026-04-14 |',
        '',
      ].join('\n'),
      'utf-8',
    )

    const { addProject } = await import('../../../src/server/registry.js')
    const { createServer } = await import('../../../src/server/index.js')

    const project = await addProject(projectRoot, '1.0.0')
    const app = await createServer()

    const changesRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/changes`,
    })
    expect(changesRes.statusCode).toBe(200)

    const payload = changesRes.json() as {
      archiveTopics: Array<{ topic: string }>
    }
    expect(payload.archiveTopics).toEqual([])

    const indexContent = await readFile(join(projectRoot, 'ygg', 'change', 'INDEX.md'), 'utf-8')
    expect(indexContent).not.toContain('broken-topic')

    await expect(stat(join(projectRoot, 'ygg', 'change', 'archive', 'broken-topic'))).rejects.toBeTruthy()

    await app.close()
  })

  it('restores archived topics back to active and keeps folders in sync', async () => {
    const { addProject } = await import('../../../src/server/registry.js')
    const { createServer } = await import('../../../src/server/index.js')

    const project = await addProject(projectRoot, '1.0.0')
    const app = await createServer()

    const archiveRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/changes/topic-one/archive`,
    })
    expect(archiveRes.statusCode).toBe(200)

    const restoreRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/changes/archive/topic-one/restore`,
    })
    expect(restoreRes.statusCode).toBe(200)

    const changesRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}/changes`,
    })
    const payload = changesRes.json() as {
      topics: Array<{ topic: string; status: string; stage: string }>
      archiveTopics: Array<{ topic: string }>
    }

    expect(payload.archiveTopics).toEqual([])
    expect(payload.topics.some(topic => topic.topic === 'topic-one' && topic.status === '🔄 진행중' && topic.stage === 'add')).toBe(true)

    const indexContent = await readFile(join(projectRoot, 'ygg', 'change', 'INDEX.md'), 'utf-8')
    expect(indexContent).toContain('| [topic-one](./topic-one/) | 🔄 진행중 | add | - | first archived topic | 2026-04-14 |')
    expect(indexContent).not.toContain('./archive/topic-one/')

    await app.close()
  })
})
