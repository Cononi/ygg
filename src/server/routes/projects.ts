import { readFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { FastifyInstance } from 'fastify'

import { runUpdate } from '../../commands/update.js'
import { syncChangeIndex } from '../../core/change-index.js'
import type { ParsedChangeIndex, SyncChangeIndexResult } from '../../core/change-index.js'
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

const EMPTY_CHANGE_STATUS: ChangeStatus = {
  total: 0,
  inProgress: 0,
  done: 0,
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

function buildChangeStatus(model: ParsedChangeIndex): ChangeStatus {
  return {
    total: model.topics.length + model.archiveTopics.length,
    inProgress: model.topics.length,
    done: model.archiveTopics.length,
  }
}

function readLatestArchiveRelease(model: ParsedChangeIndex): ArchiveReleaseInfo {
  const latest = model.archiveTopics.find((entry) => entry.latest === 'latest') ?? model.archiveTopics[0]
  return {
    version: latest?.version,
    date: latest?.date,
  }
}

async function getProjectInfo(entry: ProjectEntry, currentVersion: string): Promise<ProjectInfo> {
  const syncResult = await safeSyncChangeIndex(entry.path)

  const [targetSources, projectYggVersion, projectVersion] = await Promise.all([
    safeListTargetFileSources(entry.path),
    readYggVersion(entry.path),
    safeReadProjectVersion(entry.path),
  ])
  const latestRelease = syncResult ? readLatestArchiveRelease(syncResult.model) : {}
  const changeStatus = syncResult ? buildChangeStatus(syncResult.model) : EMPTY_CHANGE_STATUS

  const skillCount = targetSources.reduce((sum, source) => sum + source.files.skills.length, 0)
  const agentCount = targetSources.reduce((sum, source) => sum + source.files.agents.length, 0)
  const commandCount = targetSources.reduce((sum, source) => sum + source.files.commands.length, 0)

  const yggVersion = projectYggVersion ?? entry.yggVersion ?? 'unknown'
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

async function safeSyncChangeIndex(projectPath: string): Promise<SyncChangeIndexResult | null> {
  try {
    return await syncChangeIndex(projectPath)
  } catch {
    return null
  }
}

async function safeListTargetFileSources(projectPath: string) {
  try {
    return await listTargetFileSources(projectPath)
  } catch {
    return []
  }
}

async function safeReadProjectVersion(projectPath: string): Promise<string> {
  try {
    return await readConfigProjectVersion(projectPath) ?? '0.0.0'
  } catch {
    return '0.0.0'
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
    const targets = await safeListTargetFileSources(entry.path)

    return { info, targets }
  })
}
