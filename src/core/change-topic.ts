import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { readConfigProjectVersion, writeConfigProjectVersion } from '../i18n/config.js'
import type { YggPointArchiveType } from '../types/ygg-point.js'

import { findLatestTopicDate, readChangeIndex, syncChangeIndex, writeChangeIndex } from './change-index.js'

export interface ArchiveTopicResult {
  projectVersion: string
  archiveDate: string
  archiveType: string
}

type ArchiveType = YggPointArchiveType
type SemverBumpLevel = 'major' | 'minor' | 'patch'

const PATCH_ARCHIVE_TYPES = ['fix', 'docs', 'refactor', 'chore'] as const
const ARCHIVE_TYPES = ['breaking', 'feat', ...PATCH_ARCHIVE_TYPES] as const satisfies readonly ArchiveType[]

const ARCHIVE_BUMP_LEVEL: Record<ArchiveType, SemverBumpLevel> = {
  breaking: 'major',
  feat: 'minor',
  fix: 'patch',
  docs: 'patch',
  refactor: 'patch',
  chore: 'patch',
}

function parseProjectVersion(version: string | undefined): [number, number, number] {
  const parsed = version?.split('.').map((part) => Number.parseInt(part, 10))
  if (parsed && parsed.length === 3 && parsed.every((part) => Number.isFinite(part) && part >= 0)) {
    return [parsed[0] ?? 0, parsed[1] ?? 0, parsed[2] ?? 0]
  }

  return [0, 0, 0]
}

function isArchiveType(value: unknown): value is ArchiveType {
  return typeof value === 'string' && (ARCHIVE_TYPES as readonly string[]).includes(value)
}

function normalizeArchiveType(value: unknown): ArchiveType {
  return isArchiveType(value) ? value : 'fix'
}

function bumpProjectVersion(version: string | undefined, archiveType: ArchiveType): string {
  const [major, minor, patch] = parseProjectVersion(version)
  const bumpLevel = ARCHIVE_BUMP_LEVEL[archiveType]

  switch (bumpLevel) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
  }
}

function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function ensureInsideChangeDir(changeDir: string, targetDir: string): void {
  if (!targetDir.startsWith(changeDir + '/') || targetDir === changeDir) {
    throw new Error('Invalid topic path')
  }
}

async function ensureDirectory(path: string, message: string): Promise<void> {
  try {
    const info = await stat(path)
    if (!info.isDirectory()) {
      throw new Error(message)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(message)
    }
    throw error
  }
}

async function readArchiveType(topicDir: string): Promise<ArchiveType> {
  try {
    const content = await readFile(join(topicDir, 'ygg-point.json'), 'utf-8')
    const parsed = JSON.parse(content) as { archiveType?: unknown }
    return normalizeArchiveType(parsed.archiveType)
  } catch {
    // default below
  }
  return 'fix'
}

export async function archiveTopic(projectRoot: string, topicPath: string): Promise<ArchiveTopicResult> {
  const changeDir = resolve(join(projectRoot, 'ygg', 'change'))
  const archiveRoot = resolve(join(changeDir, 'archive'))
  const srcDir = resolve(join(changeDir, topicPath))
  const destDir = resolve(join(archiveRoot, topicPath))

  ensureInsideChangeDir(changeDir, srcDir)
  if (srcDir.startsWith(archiveRoot + '/')) {
    throw new Error('Topic is already archived')
  }
  await ensureDirectory(srcDir, `Topic not found: ${topicPath}`)

  const synced = await syncChangeIndex(projectRoot)
  const activeEntry = synced.model.topics.find(topic => topic.topic === topicPath)
  const description = activeEntry?.description ?? '-'
  const archiveType = await readArchiveType(srcDir)

  await mkdir(resolve(join(destDir, '..')), { recursive: true })
  await rename(srcDir, destDir)

  const nextProjectVersion = bumpProjectVersion(await readConfigProjectVersion(projectRoot), archiveType)
  const archiveDate = formatDate()

  const model = await readChangeIndex(projectRoot)
  model.topics = model.topics.filter(topic => topic.topic !== topicPath)
  model.archiveTopics = model.archiveTopics.filter(topic => topic.topic !== topicPath)
  model.archiveTopics.push({
    topic: topicPath,
    description,
    type: archiveType,
    version: `v${nextProjectVersion}`,
    latest: 'latest',
    date: archiveDate,
  })

  await writeChangeIndex(projectRoot, model)
  await writeConfigProjectVersion(projectRoot, nextProjectVersion)

  return {
    projectVersion: nextProjectVersion,
    archiveDate,
    archiveType,
  }
}

export async function restoreTopic(projectRoot: string, topicPath: string): Promise<void> {
  const topic = topicPath.replace(/^archive\//, '')
  const changeDir = resolve(join(projectRoot, 'ygg', 'change'))
  const archiveRoot = resolve(join(changeDir, 'archive'))
  const srcDir = resolve(join(archiveRoot, topic))
  const destDir = resolve(join(changeDir, topic))

  ensureInsideChangeDir(changeDir, srcDir)
  ensureInsideChangeDir(changeDir, destDir)
  await ensureDirectory(srcDir, `Archived topic not found: ${topic}`)

  await syncChangeIndex(projectRoot)
  await mkdir(resolve(join(destDir, '..')), { recursive: true })
  await rename(srcDir, destDir)

  const model = await readChangeIndex(projectRoot)
  const archiveEntry = model.archiveTopics.find(entry => entry.topic === topic)
  model.archiveTopics = model.archiveTopics.filter(entry => entry.topic !== topic)
  model.topics = model.topics.filter(entry => entry.topic !== topic)
  const restoredDate = await findLatestTopicDate(destDir) ?? archiveEntry?.date ?? formatDate()
  model.topics.push({
    topic,
    status: '🔄 진행중',
    stage: 'add',
    yggPoint: '-',
    description: archiveEntry?.description ?? '-',
    date: restoredDate,
  })

  await writeChangeIndex(projectRoot, model)
}

export async function deleteTopic(projectRoot: string, topicPath: string): Promise<void> {
  const changeDir = resolve(join(projectRoot, 'ygg', 'change'))
  const topicDir = resolve(join(changeDir, topicPath))

  ensureInsideChangeDir(changeDir, topicDir)

  await rm(topicDir, { recursive: true, force: true })
  await syncChangeIndex(projectRoot)

  const topic = topicPath.replace(/^archive\//, '')
  const model = await readChangeIndex(projectRoot)
  model.topics = model.topics.filter(entry => entry.topic !== topic)
  model.archiveTopics = model.archiveTopics.filter(entry => entry.topic !== topic)
  await writeChangeIndex(projectRoot, model)
}
