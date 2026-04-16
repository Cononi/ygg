import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('project categories and content routes', () => {
  let homeDir: string
  let projectRoot: string
  let previousHome: string | undefined

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T10:00:00+09:00'))

    previousHome = process.env.HOME
    homeDir = await mkdtemp(join(tmpdir(), 'ygg-home-'))
    projectRoot = await mkdtemp(join(tmpdir(), 'ygg-project-'))
    process.env.HOME = homeDir
    vi.resetModules()

    await mkdir(join(projectRoot, 'ygg', 'change', 'archive'), { recursive: true })
    await writeFile(
      join(projectRoot, 'ygg', 'config.yml'),
      ['targets:', '  - codex', 'projectVersion: 0.1.0', ''].join('\n'),
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

  it('creates categories, groups projects, and supports paged content CRUD', async () => {
    vi.useRealTimers()
    const { createServer } = await import('../../../src/server/index.js')
    const app = await createServer()

    const categoryRes = await app.inject({
      method: 'POST',
      url: '/api/projects/categories',
      payload: { name: 'Platform' },
    })
    expect(categoryRes.statusCode).toBe(200)

    const createProjectRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { path: projectRoot, category: 'Platform' },
    })
    expect(createProjectRes.statusCode).toBe(201)
    const projectId = createProjectRes.json<{ project: { id: string } }>().project.id

    const listRes = await app.inject({ method: 'GET', url: '/api/projects' })
    expect(listRes.statusCode).toBe(200)
    const listPayload = listRes.json<{
      categories: string[]
      groupedProjects: Array<{ category: string; projects: Array<{ id: string; category: string }> }>
    }>()
    expect(listPayload.categories).toEqual(['home', 'Platform'])
    expect(listPayload.groupedProjects.find(group => group.category === 'Platform')).toMatchObject({
      category: 'Platform',
      projects: [
        {
          id: projectId,
          category: 'Platform',
        },
      ],
    })

    const createContentRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/content`,
      payload: {
        type: 'skills',
        title: 'Skill note',
        bodyMarkdown: '# Preview\n\ncontent body',
      },
    })
    expect(createContentRes.statusCode).toBe(201)
    const contentId = createContentRes.json<{ content: { id: string } }>().content.id

    const contentListRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/content?type=skills&page=1&pageSize=5`,
    })
    expect(contentListRes.statusCode).toBe(200)
    expect(contentListRes.json()).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 5,
      items: [
        {
          id: contentId,
          type: 'skills',
          title: 'Skill note',
          bodyMarkdown: '# Preview\n\ncontent body',
        },
      ],
    })

    const deleteContentRes = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${projectId}/content/${contentId}`,
    })
    expect(deleteContentRes.statusCode).toBe(200)
    expect(deleteContentRes.json()).toEqual({ success: true })

    await app.close()
    vi.useFakeTimers()
  })

  it('renames categories and updates project description metadata', async () => {
    vi.useRealTimers()
    const { createServer } = await import('../../../src/server/index.js')
    const app = await createServer()

    await app.inject({
      method: 'POST',
      url: '/api/projects/categories',
      payload: { name: 'Platform' },
    })
    const createProjectRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { path: projectRoot, category: 'Platform' },
    })
    const projectId = createProjectRes.json<{ project: { id: string } }>().project.id

    const renameRes = await app.inject({
      method: 'PATCH',
      url: '/api/projects/categories/Platform',
      payload: { name: 'Operations' },
    })
    expect(renameRes.statusCode).toBe(200)
    expect(renameRes.json()).toEqual({
      success: true,
      categories: ['home', 'Operations'],
    })

    const metaRes = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${projectId}/meta`,
      payload: { description: 'workspace 관리 프로젝트' },
    })
    expect(metaRes.statusCode).toBe(200)

    const detailRes = await app.inject({ method: 'GET', url: `/api/projects/${projectId}` })
    expect(detailRes.statusCode).toBe(200)
    expect(detailRes.json()).toMatchObject({
      info: {
        category: 'Operations',
        description: 'workspace 관리 프로젝트',
      },
    })

    await app.close()
    vi.useFakeTimers()
  })

  it('deletes a category and moves its projects back to home', async () => {
    vi.useRealTimers()
    const { createServer } = await import('../../../src/server/index.js')
    const app = await createServer()

    await app.inject({
      method: 'POST',
      url: '/api/projects/categories',
      payload: { name: 'Platform' },
    })

    const createProjectRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { path: projectRoot, category: 'Platform' },
    })
    const projectId = createProjectRes.json<{ project: { id: string } }>().project.id

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/projects/categories/Platform',
    })
    expect(deleteRes.statusCode).toBe(200)
    expect(deleteRes.json()).toEqual({
      success: true,
      categories: ['home'],
    })

    const detailRes = await app.inject({ method: 'GET', url: `/api/projects/${projectId}` })
    expect(detailRes.statusCode).toBe(200)
    expect(detailRes.json()).toMatchObject({
      info: {
        category: 'home',
      },
    })

    const defaultDeleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/projects/categories/home',
    })
    expect(defaultDeleteRes.statusCode).toBe(400)
    expect(defaultDeleteRes.json()).toEqual({
      error: 'Default category cannot be deleted',
    })

    await app.close()
    vi.useFakeTimers()
  })
})
