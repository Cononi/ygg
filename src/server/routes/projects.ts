import { readFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { FastifyInstance } from 'fastify'

import { runUpdate } from '../../commands/update.js'
import { syncChangeIndex } from '../../core/change-index.js'
import { readConfigProjectVersion } from '../../i18n/config.js'
import { loadRegistry, addProject, removeProject, findProject } from '../registry.js'
import type { ProjectEntry } from '../registry.js'
import { listTargetFileSources } from '../target-files.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const packageRoot = __dir.includes(`${sep}src${sep}`) ? join(__dir, '../../..') : join(__dir, '..')
const require = createRequire(import.meta.url)
const pkg = require(join(packageRoot, 'package.json')) as { version: string }

type VersionStatus = 'latest' | 'patch-behind' | 'minor-behind' | 'major-behind' | 'unknown'

interface ChangeStatus {
  total: number
  inProgress: number
  done: number
}

interface ProjectInfo extends ProjectEntry {
  name: string
  currentVersion: string
  projectVersion: string
  versionStatus: VersionStatus
  latestReleaseVersion?: string
  latestReleaseDate?: string
  skillCount: number
  agentCount: number
  commandCount: number
  changeStatus: ChangeStatus
}

interface ArchiveReleaseInfo {
  version?: string
  date?: string
}

async function readYggVersion(projectPath: string): Promise<string | undefined> {
  try {
    const content = await readFile(join(projectPath, 'ygg', '.ygg-version'), 'utf-8')
    return content.trim() || undefined
  } catch {
    return undefined
  }
}

function compareVersions(projectVersion: string | undefined, currentVersion: string): VersionStatus {
  if (!projectVersion) return 'unknown'
  const parse = (v: string): [number, number, number] => v.split('.').map(Number) as [number, number, number]
  const [pMaj, pMin, pPat] = parse(projectVersion)
  const [cMaj, cMin, cPat] = parse(currentVersion)

  if (pMaj < cMaj) return 'major-behind'
  if (pMin < cMin) return 'minor-behind'
  if (pPat < cPat) return 'patch-behind'
  return 'latest'
}

async function readLatestArchiveRelease(indexPath: string): Promise<ArchiveReleaseInfo> {
  try {
    const content = await readFile(indexPath, 'utf-8')
    const lines = content.split('\n')
    let inArchive = false
    let versionIdx = -1
    let latestIdx = -1
    let dateIdx = -1
    let fallbackRow: string[] | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (/^#+\s+Archive/i.test(trimmed)) {
        inArchive = true
        versionIdx = -1
        latestIdx = -1
        dateIdx = -1
        continue
      }

      if (!inArchive || !line.startsWith('|')) continue
      if (/^\|[-\s|]+\|$/.test(line)) continue

      const cols = line.split('|').map(col => col.trim()).filter(Boolean)
      if (!cols.length) continue

      if (versionIdx === -1 && cols.some(col => /토픽/i.test(col))) {
        versionIdx = cols.findIndex(col => /버전/i.test(col))
        latestIdx = cols.findIndex(col => /최신/i.test(col))
        dateIdx = cols.findIndex(col => /날짜/i.test(col))
        continue
      }

      fallbackRow = cols
      if (latestIdx !== -1 && cols[latestIdx] === 'latest') {
        return {
          version: versionIdx !== -1 ? cols[versionIdx] : undefined,
          date: dateIdx !== -1 ? cols[dateIdx] : undefined,
        }
      }
    }

    return {
      version: fallbackRow && versionIdx !== -1 ? fallbackRow[versionIdx] : undefined,
      date: fallbackRow && dateIdx !== -1 ? fallbackRow[dateIdx] : undefined,
    }
  } catch {
    return {}
  }
}

async function getProjectInfo(entry: ProjectEntry, currentVersion: string): Promise<ProjectInfo> {
  const changeIndexPath = join(entry.path, 'ygg', 'change', 'INDEX.md')
  await syncChangeIndex(entry.path)

  const [targetSources, projectYggVersion, latestRelease] = await Promise.all([
    listTargetFileSources(entry.path),
    readYggVersion(entry.path),
    readLatestArchiveRelease(changeIndexPath),
  ])

  const skillCount = targetSources.reduce((sum, source) => sum + source.files.skills.length, 0)
  const agentCount = targetSources.reduce((sum, source) => sum + source.files.agents.length, 0)
  const commandCount = targetSources.reduce((sum, source) => sum + source.files.commands.length, 0)

  const yggVersion = projectYggVersion ?? entry.yggVersion ?? 'unknown'
  const projectVersion = await readConfigProjectVersion(entry.path) ?? '0.0.0'
  const changeStatus = await parseChangeStatus(changeIndexPath)
  const versionStatus = compareVersions(yggVersion, currentVersion)

  return {
    ...entry,
    yggVersion,
    projectVersion,
    name: entry.path.split('/').pop() ?? entry.path,
    currentVersion,
    versionStatus,
    latestReleaseVersion: latestRelease.version,
    latestReleaseDate: latestRelease.date,
    skillCount,
    agentCount,
    commandCount,
    changeStatus,
  }
}

async function parseChangeStatus(indexPath: string): Promise<{ total: number; inProgress: number; done: number }> {
  try {
    const content = await readFile(indexPath, 'utf-8')
    let inProgress = 0
    let done = 0

    let inArchive = false
    for (const line of content.split('\n')) {
      const trimmed = line.trim()

      if (/^#+\s+Archive/i.test(trimmed)) {
        inArchive = true
        continue
      }

      if (!line.startsWith('|')) continue
      if (/^\|[-\s|]+\|$/.test(line)) continue
      if (/토픽/.test(line)) continue

      const isTopicRow = /\[[^\]]+\]\(.+?\)/.test(line)
      if (!isTopicRow) continue

      if (inArchive) done++
      else inProgress++
    }

    return { total: inProgress + done, inProgress, done }
  } catch {
    return { total: 0, inProgress: 0, done: 0 }
  }
}

export function projectsRoutes(app: FastifyInstance): void {
  const currentVersion = pkg.version

  // GET /api/projects
  app.get('/api/projects', async () => {
    const registry = await loadRegistry()
    const projects = await Promise.all(registry.projects.map(e => getProjectInfo(e, currentVersion)))
    return { projects }
  })

  // POST /api/projects
  app.post<{ Body: { path: string } }>('/api/projects', async (request, reply) => {
    const { path: projectPath } = request.body
    if (!projectPath) {
      return reply.status(400).send({ error: 'path is required' })
    }

    try {
      await stat(projectPath)
    } catch {
      return reply.status(400).send({ error: `Path does not exist: ${projectPath}` })
    }

    const entry = await addProject(projectPath, currentVersion)
    return reply.status(201).send({ project: entry })
  })

  // DELETE /api/projects/:id
  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    await removeProject(entry.path)
    return { success: true }
  })

  // POST /api/projects/:id/update
  app.post<{ Params: { id: string } }>('/api/projects/:id/update', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) return reply.status(404).send({ error: 'Project not found' })

    try {
      await runUpdate(entry.path)
      return { success: true }
    } catch (e) {
      return reply.status(500).send({ error: `Update failed: ${e instanceof Error ? e.message : String(e)}` })
    }
  })

  // GET /api/projects/:id
  app.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const info = await getProjectInfo(entry, currentVersion)
    const targets = await listTargetFileSources(entry.path)

    return { info, targets }
  })
}
