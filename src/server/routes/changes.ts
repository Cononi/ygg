import { readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

import type { FastifyInstance } from 'fastify'

import { syncChangeIndex } from '../../core/change-index.js'
import { archiveTopic, deleteTopic, restoreTopic } from '../../core/change-topic.js'
import { findProject, loadRegistry } from '../registry.js'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

const EXCLUDE = new Set(['.DS_Store', 'node_modules', '.git'])

const VALID_STATUS = ['🔄 진행중', '✅ 완료']
const VALID_STAGE = ['create', 'next', 'add', 'qa', 'teams', 'prove', '—', '-']

// ──────────────────────────────────────────
// INDEX.md 수정 유틸 (T05)
// ──────────────────────────────────────────

async function readIndexLines(indexPath: string): Promise<string[]> {
  const content = await readFile(indexPath, 'utf-8')
  return content.split('\n')
}

async function writeIndexAtomic(indexPath: string, lines: string[]): Promise<void> {
  const tmpPath = indexPath + '.tmp'
  await writeFile(tmpPath, lines.join('\n'), 'utf-8')
  await rename(tmpPath, indexPath)
}

/** Active 섹션에서 토픽 행 인덱스 반환 */
function findActiveTopicLine(lines: string[], topic: string): number {
  let inArchive = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (/^#+\s+Archive/i.test(line.trim())) { inArchive = true; continue }
    if (inArchive) continue
    if (line.startsWith('|') && line.includes(topic)) return i
  }
  return -1
}

/** 헤더 행에서 field에 해당하는 컬럼 인덱스 반환 (0-based, pipe 제외) */
function findColumnIndex(lines: string[], field: string): number {
  const patterns: Record<string, RegExp> = {
    status:      /상태/i,
    stage:       /단계/i,
    yggPoint:    /ygg.?point/i,
    description: /설명/i,
    version:     /버전/i,
    latest:      /최신/i,
    date:        /날짜/i,
  }
  const pattern = patterns[field]
  if (!pattern) return -1

  for (const line of lines) {
    if (!line.startsWith('|')) continue
    if (!pattern.test(line)) continue
    if (/^\|[-\s|]+\|$/.test(line)) continue
    const cols = line.split('|').map(c => c.trim()).filter(Boolean)
    const idx = cols.findIndex(c => pattern.test(c))
    return idx
  }
  return -1
}

/** 행의 colIndex번째 셀을 newValue로 교체 */
function replaceCell(line: string, colIndex: number, newValue: string): string {
  const parts = line.split('|')
  // parts[0] = '' (앞 |), parts[1..n] = 셀, parts[last] = '' (뒤 |)
  const cellIndex = colIndex + 1
  if (cellIndex > 0 && cellIndex < parts.length - 1) {
    parts[cellIndex] = ` ${newValue} `
  }
  return parts.join('|')
}

// ──────────────────────────────────────────
// 파일 트리
// ──────────────────────────────────────────

async function buildFileTree(dir: string, basePath = ''): Promise<FileNode[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const nodes: FileNode[] = []

  for (const name of entries) {
    if (EXCLUDE.has(name)) continue

    const fullPath = join(dir, name)
    const relativePath = basePath ? `${basePath}/${name}` : name

    let info
    try {
      info = await stat(fullPath)
    } catch {
      continue
    }

    if (info.isDirectory()) {
      const children = await buildFileTree(fullPath, relativePath)
      nodes.push({ name, path: relativePath, type: 'dir', children })
    } else {
      nodes.push({ name, path: relativePath, type: 'file' })
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

// ──────────────────────────────────────────
// 라우트 등록
// ──────────────────────────────────────────

export function changesRoutes(app: FastifyInstance): void {
  // ── GET /api/projects/:id/changes — 토픽 목록
  app.get<{ Params: { id: string } }>('/api/projects/:id/changes', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) return reply.status(404).send({ error: 'Project not found' })

    try {
      const { model } = await syncChangeIndex(entry.path)
      return { topics: model.topics, archiveTopics: model.archiveTopics }
    } catch {
      return { topics: [], archiveTopics: [] }
    }
  })

  // ── PATCH /api/projects/:id/changes/* — 상태/단계 수정 (T06)
  app.patch<{
    Params: { id: string; '*': string }
    Body: { field: 'status' | 'stage'; value: string }
  }>('/api/projects/:id/changes/*', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) return reply.status(404).send({ error: 'Project not found' })

    const topicPath = request.params['*']
    const { field, value } = request.body

    if (field === 'status' && !VALID_STATUS.includes(value)) {
      return reply.status(400).send({ error: 'Invalid status value' })
    }
    if (field === 'stage' && !VALID_STAGE.includes(value)) {
      return reply.status(400).send({ error: 'Invalid stage value' })
    }

    const changeDir = resolve(join(entry.path, 'ygg', 'change'))
    const topicDir = resolve(join(changeDir, topicPath))
    if (!topicDir.startsWith(changeDir + '/') && topicDir !== changeDir) {
      return reply.status(400).send({ error: 'Invalid topic path' })
    }

    await syncChangeIndex(entry.path)
    const indexPath = join(entry.path, 'ygg', 'change', 'INDEX.md')
    const lines = await readIndexLines(indexPath)

    const topicLineIdx = findActiveTopicLine(lines, topicPath)
    if (topicLineIdx === -1) return reply.status(404).send({ error: 'Topic not found in INDEX.md' })

    const colIdx = findColumnIndex(lines, field)
    if (colIdx === -1) return reply.status(400).send({ error: `Column '${field}' not found in INDEX.md` })

    lines[topicLineIdx] = replaceCell(lines[topicLineIdx] ?? '', colIdx, value)
    await writeIndexAtomic(indexPath, lines)

    return { success: true }
  })

  // ── DELETE /api/projects/:id/changes/* — 토픽 삭제 (T07)
  app.delete<{ Params: { id: string; '*': string } }>('/api/projects/:id/changes/*', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) return reply.status(404).send({ error: 'Project not found' })

    try {
      await deleteTopic(entry.path, request.params['*'])
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Delete failed' })
    }

    return { success: true }
  })

  // ── POST /api/projects/:id/changes/* — Archive 이동 (suffix /archive 감지)
  app.post<{ Params: { id: string; '*': string } }>('/api/projects/:id/changes/*', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) return reply.status(404).send({ error: 'Project not found' })

    const rawPath = request.params['*']

    try {
      if (rawPath.endsWith('/archive')) {
        const topicPath = rawPath.slice(0, -'/archive'.length)
        await archiveTopic(entry.path, topicPath)
        return { success: true }
      }

      if (rawPath.endsWith('/restore')) {
        const topicPath = rawPath.slice(0, -'/restore'.length)
        await restoreTopic(entry.path, topicPath)
        return { success: true }
      }
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Unsupported POST action' })
    }

    return reply.status(400).send({ error: 'Unsupported POST action' })
  })

  // ── PUT /api/projects/:id/changes/*?file= — 파일 저장 (T09)
  app.put<{
    Params: { id: string; '*': string }
    Querystring: { file?: string }
    Body: { content: string }
  }>('/api/projects/:id/changes/*', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) return reply.status(404).send({ error: 'Project not found' })

    const topicPath = request.params['*']
    const filePath = request.query.file
    if (!filePath) return reply.status(400).send({ error: 'file query param required' })

    const changeDir = resolve(join(entry.path, 'ygg', 'change'))
    const topicDir = resolve(join(changeDir, topicPath))

    if (!topicDir.startsWith(changeDir + '/') && topicDir !== changeDir) {
      return reply.status(400).send({ error: 'Invalid topic path' })
    }

    const ext = extname(filePath).toLowerCase()
    if (ext !== '.md' && ext !== '.json') {
      return reply.status(400).send({ error: 'Only .md and .json files can be edited' })
    }

    const resolved = resolve(join(topicDir, filePath))
    if (!resolved.startsWith(topicDir + '/') && resolved !== topicDir) {
      return reply.status(400).send({ error: 'Invalid file path' })
    }

    const { content } = request.body
    if (typeof content !== 'string') {
      return reply.status(400).send({ error: 'content must be a string' })
    }

    await writeFile(resolved, content, 'utf-8')
    return { success: true }
  })

  // ── GET /api/projects/:id/changes/* — 파일 트리 OR 파일 내용
  app.get<{
    Params: { id: string; '*': string }
    Querystring: { file?: string }
  }>('/api/projects/:id/changes/*', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) return reply.status(404).send({ error: 'Project not found' })

    const topicPath = request.params['*']
    const filePath = request.query.file
    const changeDir = resolve(join(entry.path, 'ygg', 'change'))
    const topicDir = resolve(join(changeDir, topicPath))

    if (!topicDir.startsWith(changeDir + '/') && topicDir !== changeDir) {
      return reply.status(400).send({ error: 'Invalid topic path' })
    }

    if (filePath !== undefined) {
      const resolved = resolve(join(topicDir, filePath))
      if (!resolved.startsWith(topicDir + '/') && resolved !== topicDir) {
        return reply.status(400).send({ error: 'Invalid file path' })
      }

      const ext = extname(filePath).toLowerCase()
      if (ext !== '.md' && ext !== '.json') {
        return reply.status(400).send({ error: 'Unsupported file type' })
      }

      try {
        const content = await readFile(resolved, 'utf-8')
        return { content, fileType: ext === '.json' ? 'json' : 'markdown' }
      } catch {
        return reply.status(404).send({ error: 'File not found' })
      }
    }

    try {
      await stat(topicDir)
    } catch {
      return reply.status(404).send({ error: 'Topic not found' })
    }

    const files = await buildFileTree(topicDir)
    return { topic: topicPath, files }
  })
}
