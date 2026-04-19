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

export interface CategoryEntry {
  name: string
  order: number
}

export interface Registry {
  version: 3
  defaultCategory: string
  categories: CategoryEntry[]
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

type LegacyCategoryEntry = string | { name?: string; order?: number }

function getProjectName(projectPath: string): string {
  return resolve(projectPath).split('/').pop() ?? resolve(projectPath)
}

function normalizeCategoryName(category?: string, fallback = DEFAULT_PROJECT_CATEGORY): string {
  const trimmed = category?.trim() ?? ''
  if (!trimmed || trimmed === 'Uncategorized') {
    return fallback
  }
  return trimmed
}

function normalizeProject(entry: LegacyProjectEntry, fallbackCategory: string): ProjectEntry {
  const createdAt = entry.createdAt ?? entry.addedAt ?? new Date().toISOString()
  return {
    id: entry.id,
    path: resolve(entry.path),
    name: entry.name ?? getProjectName(entry.path),
    category: normalizeCategoryName(entry.category, fallbackCategory),
    description: entry.description?.trim() || undefined,
    createdAt,
    updatedAt: entry.updatedAt ?? createdAt,
    yggVersion: entry.yggVersion,
  }
}

function compareCategoryOrder(left: CategoryEntry, right: CategoryEntry): number {
  if (left.order !== right.order) {
    return left.order - right.order
  }
  return left.name.localeCompare(right.name)
}

function dedupeCategoryNames(names: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    if (!seen.has(name)) {
      seen.add(name)
      result.push(name)
    }
  }
  return result
}

function getSortedCategoryEntries(registry: Registry): CategoryEntry[] {
  return [...registry.categories].sort(compareCategoryOrder)
}

export function getCategoryNames(registry: Registry): string[] {
  return getSortedCategoryEntries(registry).map(category => category.name)
}

function createCategoryEntries(names: string[]): CategoryEntry[] {
  return dedupeCategoryNames(names).map((name, index) => ({ name, order: index }))
}

function normalizeRegistry(registry: {
  version?: number
  defaultCategory?: string
  categories?: LegacyCategoryEntry[]
  projects?: LegacyProjectEntry[]
}): Registry {
  const rawDefaultCategory = normalizeCategoryName(registry.defaultCategory, DEFAULT_PROJECT_CATEGORY)
  const rawCategories = (registry.categories ?? [])
    .map((category, index) => {
      if (typeof category === 'string') {
        return { name: normalizeCategoryName(category, rawDefaultCategory), order: index }
      }
      return {
        name: normalizeCategoryName(category.name, rawDefaultCategory),
        order: typeof category.order === 'number' ? category.order : index,
      }
    })
    .sort(compareCategoryOrder)
  const projects = (registry.projects ?? []).map(entry => normalizeProject(entry, rawDefaultCategory))
  const categoryNames = createCategoryEntries([
    ...rawCategories.map(category => category.name),
    rawDefaultCategory,
    ...projects.map(project => project.category),
  ]).map(category => category.name)
  const defaultCategory = categoryNames.includes(rawDefaultCategory) ? rawDefaultCategory : DEFAULT_PROJECT_CATEGORY

  return {
    version: 3,
    defaultCategory,
    categories: createCategoryEntries(categoryNames),
    projects,
  }
}

export async function loadRegistry(): Promise<Registry> {
  try {
    const content = await readFile(REGISTRY_PATH, 'utf-8')
    return normalizeRegistry(JSON.parse(content) as Registry)
  } catch {
    return {
      version: 3,
      defaultCategory: DEFAULT_PROJECT_CATEGORY,
      categories: [{ name: DEFAULT_PROJECT_CATEGORY, order: 0 }],
      projects: [],
    }
  }
}

export async function saveRegistry(registry: Registry): Promise<void> {
  await mkdir(YGG_DIR, { recursive: true })
  await writeFile(REGISTRY_PATH, JSON.stringify(normalizeRegistry(registry), null, 2) + '\n', 'utf-8')
}

export async function ensureCategory(registry: Registry, category: string): Promise<boolean> {
  const normalizedCategory = normalizeCategoryName(category, registry.defaultCategory)
  if (getCategoryNames(registry).includes(normalizedCategory)) {
    return false
  }

  registry.categories.push({
    name: normalizedCategory,
    order: registry.categories.length,
  })
  await saveRegistry(registry)
  return true
}

export async function addProject(projectPath: string, yggVersion: string, category?: string): Promise<ProjectEntry> {
  const normalizedPath = resolve(projectPath)
  const registry = await loadRegistry()
  const normalizedCategory = normalizeCategoryName(category, registry.defaultCategory)

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

  const normalizedCategory = normalizeCategoryName(category, registry.defaultCategory)
  await ensureCategory(registry, normalizedCategory)
  project.category = normalizedCategory
  project.updatedAt = new Date().toISOString()
  await saveRegistry(registry)
  return project
}

export async function renameCategory(currentName: string, nextName: string): Promise<Registry | null> {
  const registry = await loadRegistry()
  const current = normalizeCategoryName(currentName, registry.defaultCategory)
  const next = normalizeCategoryName(nextName, registry.defaultCategory)

  if (current === registry.defaultCategory) {
    throw new Error('Default category cannot be renamed')
  }
  const currentEntry = registry.categories.find(category => category.name === current)
  if (!currentEntry) {
    return null
  }
  if (registry.categories.some(category => category.name === next)) {
    throw new Error('Category already exists')
  }

  currentEntry.name = next

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
  const normalizedName = normalizeCategoryName(name, registry.defaultCategory)

  if (normalizedName === registry.defaultCategory) {
    throw new Error('Default category cannot be deleted')
  }
  if (!registry.categories.some(category => category.name === normalizedName)) {
    return null
  }

  registry.categories = registry.categories.filter(category => category.name !== normalizedName)

  const now = new Date().toISOString()
  for (const project of registry.projects) {
    if (project.category === normalizedName) {
      project.category = registry.defaultCategory
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

export async function updateDefaultCategory(name: string): Promise<Registry | null> {
  const registry = await loadRegistry()
  const normalizedName = normalizeCategoryName(name, registry.defaultCategory)
  if (!registry.categories.some(category => category.name === normalizedName)) {
    return null
  }

  registry.defaultCategory = normalizedName
  await saveRegistry(registry)
  return registry
}

export async function reorderCategories(categories: string[]): Promise<Registry> {
  const registry = await loadRegistry()
  const normalized = categories.map(category => normalizeCategoryName(category, registry.defaultCategory))
  const current = getCategoryNames(registry)

  const hasSameLength = normalized.length === current.length
  const hasSameMembers = hasSameLength && normalized.every(category => current.includes(category))
  const hasUniqueMembers = new Set(normalized).size === normalized.length
  if (!hasSameMembers || !hasUniqueMembers) {
    throw new Error('Categories payload must include every category exactly once')
  }

  registry.categories = normalized.map((name, order) => ({ name, order }))
  await saveRegistry(registry)
  return registry
}
