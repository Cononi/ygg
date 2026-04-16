import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { nanoid } from 'nanoid'

export interface ProjectEntry {
  id: string
  path: string
  name: string
  category: string
  description?: string
  createdAt: string
  updatedAt: string
  yggVersion: string
}

export interface Registry {
  version: 2
  categories: string[]
  projects: ProjectEntry[]
}

const YGG_DIR = join(homedir(), '.ygg')
const REGISTRY_PATH = join(YGG_DIR, 'registry.json')
export const DEFAULT_PROJECT_CATEGORY = 'home'

type LegacyProjectEntry = {
  id: string
  path: string
  addedAt?: string
  createdAt?: string
  updatedAt?: string
  category?: string
  description?: string
  name?: string
  yggVersion: string
}

function getProjectName(projectPath: string): string {
  return resolve(projectPath).split('/').pop() ?? resolve(projectPath)
}

function normalizeCategoryName(category?: string): string {
  const trimmed = category?.trim() ?? ''
  if (!trimmed || trimmed === 'Uncategorized') {
    return DEFAULT_PROJECT_CATEGORY
  }
  return trimmed
}

function normalizeProject(entry: LegacyProjectEntry): ProjectEntry {
  const createdAt = entry.createdAt ?? entry.addedAt ?? new Date().toISOString()
  return {
    id: entry.id,
    path: resolve(entry.path),
    name: entry.name ?? getProjectName(entry.path),
    category: normalizeCategoryName(entry.category),
    description: entry.description?.trim() || undefined,
    createdAt,
    updatedAt: entry.updatedAt ?? createdAt,
    yggVersion: entry.yggVersion,
  }
}

function normalizeRegistry(registry: {
  version?: number
  categories?: string[]
  projects?: LegacyProjectEntry[]
}): Registry {
  const projects = (registry.projects ?? []).map(normalizeProject)
  const categories = Array.from(new Set([
    DEFAULT_PROJECT_CATEGORY,
    ...(registry.categories ?? []).map(normalizeCategoryName),
    ...projects.map(project => project.category),
  ]))
    .sort((left, right) => left.localeCompare(right))

  return {
    version: 2,
    categories,
    projects,
  }
}

export async function loadRegistry(): Promise<Registry> {
  try {
    const content = await readFile(REGISTRY_PATH, 'utf-8')
    return normalizeRegistry(JSON.parse(content) as Registry)
  } catch {
    return { version: 2, categories: [DEFAULT_PROJECT_CATEGORY], projects: [] }
  }
}

export async function saveRegistry(registry: Registry): Promise<void> {
  await mkdir(YGG_DIR, { recursive: true })
  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8')
}

export async function ensureCategory(registry: Registry, category: string): Promise<boolean> {
  const normalizedCategory = normalizeCategoryName(category)
  if (registry.categories.includes(normalizedCategory)) {
    return false
  }

  registry.categories.push(normalizedCategory)
  registry.categories.sort((left, right) => left.localeCompare(right))
  await saveRegistry(registry)
  return true
}

export async function addProject(projectPath: string, yggVersion: string, category = DEFAULT_PROJECT_CATEGORY): Promise<ProjectEntry> {
  const normalizedPath = resolve(projectPath)
  const registry = await loadRegistry()
  const normalizedCategory = normalizeCategoryName(category)

  const existing = registry.projects.find(p => p.path === normalizedPath)
  if (existing) {
    let changed = false
    if (existing.yggVersion !== yggVersion) {
      existing.yggVersion = yggVersion
      changed = true
    }
    if (existing.category !== normalizedCategory) {
      existing.category = normalizedCategory
      existing.updatedAt = new Date().toISOString()
      changed = true
    }
    if (changed) {
      await ensureCategory(registry, normalizedCategory)
      await saveRegistry(registry)
    }
    return existing
  }

  await ensureCategory(registry, normalizedCategory)

  const now = new Date().toISOString()

  const entry: ProjectEntry = {
    id: nanoid(8),
    path: normalizedPath,
    name: getProjectName(normalizedPath),
    category: normalizedCategory,
    createdAt: now,
    updatedAt: now,
    yggVersion,
  }

  registry.projects.push(entry)
  await saveRegistry(registry)
  return entry
}

export async function removeProject(projectPath: string): Promise<boolean> {
  const normalizedPath = resolve(projectPath)
  const registry = await loadRegistry()

  const index = registry.projects.findIndex(p => p.path === normalizedPath)
  if (index === -1) {
    return false
  }

  registry.projects.splice(index, 1)
  await saveRegistry(registry)
  return true
}

export function findProject(registry: Registry, id: string): ProjectEntry | undefined {
  return registry.projects.find(p => p.id === id)
}

export async function moveProjectCategory(projectId: string, category: string): Promise<ProjectEntry | null> {
  const registry = await loadRegistry()
  const project = findProject(registry, projectId)
  if (!project) {
    return null
  }

  const normalizedCategory = normalizeCategoryName(category)
  await ensureCategory(registry, normalizedCategory)
  project.category = normalizedCategory
  project.updatedAt = new Date().toISOString()
  await saveRegistry(registry)
  return project
}

export async function renameCategory(currentName: string, nextName: string): Promise<Registry | null> {
  const registry = await loadRegistry()
  const current = normalizeCategoryName(currentName)
  const next = normalizeCategoryName(nextName)

  if (current === DEFAULT_PROJECT_CATEGORY) {
    throw new Error('Default category cannot be renamed')
  }
  if (!registry.categories.includes(current)) {
    return null
  }
  if (registry.categories.includes(next)) {
    throw new Error('Category already exists')
  }

  registry.categories = registry.categories
    .map(category => category === current ? next : category)
    .sort((left, right) => left.localeCompare(right))

  const now = new Date().toISOString()
  for (const project of registry.projects) {
    if (project.category === current) {
      project.category = next
      project.updatedAt = now
    }
  }

  await saveRegistry(registry)
  return registry
}

export async function deleteCategory(name: string): Promise<Registry | null> {
  const registry = await loadRegistry()
  const normalizedName = normalizeCategoryName(name)

  if (normalizedName === DEFAULT_PROJECT_CATEGORY) {
    throw new Error('Default category cannot be deleted')
  }
  if (!registry.categories.includes(normalizedName)) {
    return null
  }

  registry.categories = registry.categories.filter(category => category !== normalizedName)

  const now = new Date().toISOString()
  for (const project of registry.projects) {
    if (project.category === normalizedName) {
      project.category = DEFAULT_PROJECT_CATEGORY
      project.updatedAt = now
    }
  }

  await saveRegistry(registry)
  return registry
}

export async function updateProjectMeta(
  projectId: string,
  input: { description?: string },
): Promise<ProjectEntry | null> {
  const registry = await loadRegistry()
  const project = findProject(registry, projectId)
  if (!project) {
    return null
  }

  project.description = input.description?.trim() || undefined
  project.updatedAt = new Date().toISOString()
  await saveRegistry(registry)
  return project
}
