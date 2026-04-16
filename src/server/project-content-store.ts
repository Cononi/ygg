import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { nanoid } from 'nanoid'

export type ProjectContentType = 'skills' | 'agents' | 'commands' | 'changes'

export interface ProjectContentEntry {
  id: string
  projectId: string
  type: ProjectContentType
  title: string
  bodyMarkdown: string
  createdAt: string
  updatedAt: string
}

interface ProjectContentStore {
  version: 1
  items: ProjectContentEntry[]
}

export interface PagedProjectContent {
  items: ProjectContentEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const VALID_CONTENT_TYPES: ProjectContentType[] = ['skills', 'agents', 'commands', 'changes']

function getStorePath(projectPath: string): string {
  return join(projectPath, 'ygg', 'dashboard-content.json')
}

async function loadStore(projectPath: string): Promise<ProjectContentStore> {
  try {
    const content = await readFile(getStorePath(projectPath), 'utf-8')
    const parsed = JSON.parse(content) as Partial<ProjectContentStore>
    return {
      version: 1,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    }
  } catch {
    return {
      version: 1,
      items: [],
    }
  }
}

async function saveStore(projectPath: string, store: ProjectContentStore): Promise<void> {
  await mkdir(join(projectPath, 'ygg'), { recursive: true })
  await writeFile(getStorePath(projectPath), JSON.stringify(store, null, 2) + '\n', 'utf-8')
}

export function isProjectContentType(value: string): value is ProjectContentType {
  return VALID_CONTENT_TYPES.includes(value as ProjectContentType)
}

export async function listProjectContent(
  projectPath: string,
  projectId: string,
  type: ProjectContentType,
  page: number,
  pageSize: number,
): Promise<PagedProjectContent> {
  const store = await loadStore(projectPath)
  const filtered = store.items
    .filter(item => item.projectId === projectId && item.type === type)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const total = filtered.length
  const safePageSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(total / safePageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * safePageSize

  return {
    items: filtered.slice(start, start + safePageSize),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  }
}

export async function summarizeProjectContent(
  projectPath: string,
  projectId: string,
): Promise<Record<ProjectContentType, number>> {
  const store = await loadStore(projectPath)
  const summary: Record<ProjectContentType, number> = {
    skills: 0,
    agents: 0,
    commands: 0,
    changes: 0,
  }

  for (const item of store.items) {
    if (item.projectId !== projectId) continue
    summary[item.type] += 1
  }

  return summary
}

export async function createProjectContent(
  projectPath: string,
  input: Omit<ProjectContentEntry, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ProjectContentEntry> {
  const store = await loadStore(projectPath)
  const now = new Date().toISOString()
  const entry: ProjectContentEntry = {
    ...input,
    id: nanoid(10),
    createdAt: now,
    updatedAt: now,
  }

  store.items.push(entry)
  await saveStore(projectPath, store)
  return entry
}

export async function deleteProjectContent(
  projectPath: string,
  projectId: string,
  contentId: string,
): Promise<boolean> {
  const store = await loadStore(projectPath)
  const before = store.items.length
  store.items = store.items.filter(item => !(item.projectId === projectId && item.id === contentId))
  if (store.items.length === before) {
    return false
  }
  await saveStore(projectPath, store)
  return true
}
