import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import type { FastifyInstance } from 'fastify'

import { runUpdate } from '../../commands/update.js'
import { syncChangeIndex } from '../../core/change-index.js'
import type { ParsedChangeIndex } from '../../core/change-index.js'
import { readConfigProjectVersion } from '../../i18n/config.js'
import {
  createProjectContent,
  deleteProjectContent,
  isProjectContentType,
  listProjectContent,
} from '../project-content-store.js'
import {
  loadRegistry,
  addProject,
  removeProject,
  findProject,
  moveProjectCategory,
  ensureCategory,
  renameCategory,
  deleteCategory,
  updateProjectMeta,
} from '../registry.js'
import type { ProjectEntry, Registry } from '../registry.js'
import { listTargetFileSources } from '../target-files.js'
import { getPackageVersion } from '../../utils/package-version.js'

type VersionStatus = 'latest' | 'patch-behind' | 'minor-behind' | 'major-behind' | 'unknown'

interface ContentSummary {
  skills: number
  agents: number
  commands: number
  changes: number
}

interface ProjectInfo extends ProjectEntry {
  currentVersion: string
  projectVersion: string
  versionStatus: VersionStatus
  contentSummary: ContentSummary
  latestReleaseVersion?: string
  latestReleaseDate?: string
  changeStatus: {
    total: number
    inProgress: number
    done: number
  }
}

async function readYggVersion(projectPath: string): Promise<string | undefined> {
  try {
    const content = await readFile(join(projectPath, 'ygg', '.ygg-version'), 'utf-8')
    return content.trim() || undefined
  } catch {
    return undefined
  }
}

function buildChangeStatus(model: ParsedChangeIndex) {
  return {
    total: model.topics.length + model.archiveTopics.length,
    inProgress: model.topics.length,
    done: model.archiveTopics.length,
  }
}

function readLatestArchiveRelease(model: ParsedChangeIndex): { version?: string; date?: string } {
  const latest = model.archiveTopics.find(entry => entry.latest === 'latest') ?? model.archiveTopics[0]
  return {
    version: latest?.version,
    date: latest?.date,
  }
}

async function safeSyncChangeIndex(projectPath: string) {
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

function compareVersions(projectVersion: string | undefined, currentVersion: string): VersionStatus {
  if (!projectVersion) return 'unknown'
  const parse = (value: string): [number, number, number] => value.split('.').map(Number) as [number, number, number]
  const [projectMajor, projectMinor, projectPatch] = parse(projectVersion)
  const [currentMajor, currentMinor, currentPatch] = parse(currentVersion)

  if (projectMajor < currentMajor) return 'major-behind'
  if (projectMinor < currentMinor) return 'minor-behind'
  if (projectPatch < currentPatch) return 'patch-behind'
  return 'latest'
}

function groupProjectsByCategory(projects: ProjectInfo[], categories: string[]) {
  return categories.map(category => ({
    category,
    projects: projects
      .filter(project => project.category === category)
      .sort((left, right) => left.name.localeCompare(right.name)),
  }))
}

function summarizeProjectArtifacts(
  targetSources: Awaited<ReturnType<typeof safeListTargetFileSources>>,
  changeStatus: ProjectInfo['changeStatus'],
): ContentSummary {
  return {
    skills: targetSources.reduce((sum, source) => sum + source.files.skills.length, 0),
    agents: targetSources.reduce((sum, source) => sum + source.files.agents.length, 0),
    commands: targetSources.reduce((sum, source) => sum + source.files.commands.length, 0),
    changes: changeStatus.total,
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
  const changeStatus = syncResult ? buildChangeStatus(syncResult.model) : {
    total: 0,
    inProgress: 0,
    done: 0,
  }
  const contentSummary = summarizeProjectArtifacts(targetSources, changeStatus)
  const yggVersion = projectYggVersion ?? entry.yggVersion ?? '0.0.0'

  return {
    ...entry,
    currentVersion,
    projectVersion,
    yggVersion,
    versionStatus: compareVersions(yggVersion, currentVersion),
    contentSummary,
    latestReleaseVersion: latestRelease.version,
    latestReleaseDate: latestRelease.date,
    changeStatus,
  }
}

function buildProjectListPayload(registry: Registry, projects: ProjectInfo[]) {
  const sortedCategories = [...registry.categories].sort((left, right) => left.localeCompare(right))
  return {
    categories: sortedCategories,
    projects,
    groupedProjects: groupProjectsByCategory(projects, sortedCategories),
  }
}

export function projectsRoutes(app: FastifyInstance): void {
  const currentVersion = getPackageVersion()

  app.get('/api/projects', async () => {
    const registry = await loadRegistry()
    const projects = await Promise.all(registry.projects.map(entry => getProjectInfo(entry, currentVersion)))
    return buildProjectListPayload(registry, projects)
  })

  app.post<{ Body: { path: string; category?: string } }>('/api/projects', async (request, reply) => {
    const { path: projectPath, category } = request.body
    if (!projectPath) {
      return reply.status(400).send({ error: 'path is required' })
    }

    try {
      await stat(projectPath)
    } catch {
      return reply.status(400).send({ error: `Path does not exist: ${projectPath}` })
    }

    const project = await addProject(projectPath, currentVersion, category)
    return reply.status(201).send({ project })
  })

  app.post<{ Body: { name: string } }>('/api/projects/categories', async (request, reply) => {
    const name = request.body.name?.trim()
    if (!name) {
      return reply.status(400).send({ error: 'name is required' })
    }

    const registry = await loadRegistry()
    await ensureCategory(registry, name)
    return { success: true, categories: registry.categories }
  })

  app.patch<{ Params: { name: string }; Body: { name: string } }>('/api/projects/categories/:name', async (request, reply) => {
    const nextName = request.body.name?.trim()
    if (!nextName) {
      return reply.status(400).send({ error: 'name is required' })
    }

    try {
      const registry = await renameCategory(request.params.name, nextName)
      if (!registry) {
        return reply.status(404).send({ error: 'Category not found' })
      }
      return { success: true, categories: registry.categories }
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Failed to rename category' })
    }
  })

  app.delete<{ Params: { name: string } }>('/api/projects/categories/:name', async (request, reply) => {
    try {
      const registry = await deleteCategory(request.params.name)
      if (!registry) {
        return reply.status(404).send({ error: 'Category not found' })
      }
      return { success: true, categories: registry.categories }
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Failed to delete category' })
    }
  })

  app.patch<{ Params: { id: string }; Body: { category: string } }>('/api/projects/:id/category', async (request, reply) => {
    const category = request.body.category?.trim()
    if (!category) {
      return reply.status(400).send({ error: 'category is required' })
    }

    const updated = await moveProjectCategory(request.params.id, category)
    if (!updated) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    return { project: updated }
  })

  app.patch<{ Params: { id: string }; Body: { description?: string } }>('/api/projects/:id/meta', async (request, reply) => {
    const updated = await updateProjectMeta(request.params.id, {
      description: request.body.description,
    })
    if (!updated) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    return { project: updated }
  })

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    await removeProject(entry.path)
    return { success: true }
  })

  app.post<{ Params: { id: string } }>('/api/projects/:id/update', async (request, reply) => {
    const registry = await loadRegistry()
    const entry = findProject(registry, request.params.id)
    if (!entry) return reply.status(404).send({ error: 'Project not found' })

    try {
      await runUpdate(entry.path)
      return { success: true }
    } catch (error) {
      return reply.status(500).send({ error: `Update failed: ${error instanceof Error ? error.message : String(error)}` })
    }
  })

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

  app.get<{ Params: { id: string }; Querystring: { type?: string; page?: string; pageSize?: string } }>(
    '/api/projects/:id/content',
    async (request, reply) => {
      const registry = await loadRegistry()
      const entry = findProject(registry, request.params.id)
      if (!entry) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      const type = request.query.type
      if (!type || !isProjectContentType(type)) {
        return reply.status(400).send({ error: 'valid type is required' })
      }

      const page = Number.parseInt(request.query.page ?? '1', 10)
      const pageSize = Number.parseInt(request.query.pageSize ?? '10', 10)
      const result = await listProjectContent(entry.path, entry.id, type, page, pageSize)
      return result
    },
  )

  app.post<{ Params: { id: string }; Body: { type: string; title: string; bodyMarkdown: string } }>(
    '/api/projects/:id/content',
    async (request, reply) => {
      const registry = await loadRegistry()
      const entry = findProject(registry, request.params.id)
      if (!entry) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      const { type, title, bodyMarkdown } = request.body
      if (!isProjectContentType(type)) {
        return reply.status(400).send({ error: 'valid type is required' })
      }
      if (!title?.trim()) {
        return reply.status(400).send({ error: 'title is required' })
      }
      if (!bodyMarkdown?.trim()) {
        return reply.status(400).send({ error: 'bodyMarkdown is required' })
      }

      const content = await createProjectContent(entry.path, {
        projectId: entry.id,
        type,
        title: title.trim(),
        bodyMarkdown,
      })
      return reply.status(201).send({ content })
    },
  )

  app.delete<{ Params: { id: string; contentId: string } }>(
    '/api/projects/:id/content/:contentId',
    async (request, reply) => {
      const registry = await loadRegistry()
      const entry = findProject(registry, request.params.id)
      if (!entry) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      const removed = await deleteProjectContent(entry.path, entry.id, request.params.contentId)
      if (!removed) {
        return reply.status(404).send({ error: 'Content not found' })
      }
      return { success: true }
    },
  )
}
