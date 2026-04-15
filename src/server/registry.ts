import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { nanoid } from 'nanoid'

export interface ProjectEntry {
  id: string
  path: string
  addedAt: string
  yggVersion: string
}

export interface Registry {
  version: 1
  projects: ProjectEntry[]
}

const YGG_DIR = join(homedir(), '.ygg')
const REGISTRY_PATH = join(YGG_DIR, 'registry.json')

export async function loadRegistry(): Promise<Registry> {
  try {
    const content = await readFile(REGISTRY_PATH, 'utf-8')
    return JSON.parse(content) as Registry
  } catch {
    return { version: 1, projects: [] }
  }
}

export async function saveRegistry(registry: Registry): Promise<void> {
  await mkdir(YGG_DIR, { recursive: true })
  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8')
}

export async function addProject(projectPath: string, yggVersion: string): Promise<ProjectEntry> {
  const normalizedPath = resolve(projectPath)
  const registry = await loadRegistry()

  const existing = registry.projects.find(p => p.path === normalizedPath)
  if (existing) {
    if (existing.yggVersion !== yggVersion) {
      existing.yggVersion = yggVersion
      await saveRegistry(registry)
    }
    return existing
  }

  const entry: ProjectEntry = {
    id: nanoid(8),
    path: normalizedPath,
    addedAt: new Date().toISOString(),
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
