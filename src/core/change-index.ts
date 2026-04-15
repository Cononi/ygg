import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export interface ActiveChangeEntry {
  topic: string
  status: string
  stage: string
  yggPoint: string
  description: string
  date: string
}

export interface ArchiveChangeEntry {
  topic: string
  description: string
  version: string
  latest: string
  date: string
}

export interface ParsedChangeIndex {
  topics: ActiveChangeEntry[]
  archiveTopics: ArchiveChangeEntry[]
}

export interface SyncChangeIndexResult {
  model: ParsedChangeIndex
  removedArchiveTopics: string[]
  removedOrphanDirs: string[]
}

const ACTIVE_HEADER = '| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |'
const ACTIVE_SEPARATOR = '|---|---|---|---|---|---|'
const ARCHIVE_HEADER = '| 토픽 | 설명 | 버전 | 최신 | 날짜 |'
const ARCHIVE_SEPARATOR = '|---|---|---|---|---|'

function normalizeCell(value: string | undefined): string {
  const trimmed = value?.trim() ?? ''
  return trimmed || '-'
}

function parseHeaderColumns(headerLine: string): Record<string, number> {
  const cols = headerLine.split('|').map(c => c.trim()).filter(Boolean)
  const map: Record<string, number> = {}
  cols.forEach((col, i) => {
    if (/토픽/i.test(col)) map['topic'] = i
    if (/상태/i.test(col)) map['status'] = i
    if (/단계/i.test(col)) map['stage'] = i
    if (/ygg.?point/i.test(col)) map['yggPoint'] = i
    if (/설명/i.test(col)) map['description'] = i
    if (/버전/i.test(col)) map['version'] = i
    if (/최신/i.test(col)) map['latest'] = i
    if (/날짜/i.test(col)) map['date'] = i
  })
  return map
}

function extractTopic(topicRaw: string): string {
  const match = topicRaw.match(/\[(.+?)\]/)
  return (match ? match[1] : topicRaw).trim()
}

function readColumn(cols: string[], map: Record<string, number>, key: string): string {
  const idx = map[key]
  if (idx === undefined) return '-'
  return normalizeCell(cols[idx])
}

export function parseChangeIndex(content: string): ParsedChangeIndex {
  const lines = content.split('\n')
  const topics: ActiveChangeEntry[] = []
  const archiveTopics: ArchiveChangeEntry[] = []
  let inArchive = false
  let colMap: Record<string, number> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^#+\s+Archive/i.test(trimmed)) {
      inArchive = true
      colMap = {}
      continue
    }

    if (!line.startsWith('|')) continue
    if (/^\|[-\s|]+\|$/.test(line)) continue

    if (/토픽/.test(line)) {
      colMap = parseHeaderColumns(line)
      continue
    }

    const cols = line.split('|').slice(1, -1).map(c => c.trim())
    if (!cols.length) continue

    const topic = extractTopic(readColumn(cols, colMap, 'topic'))
    if (!topic || topic === '-') continue

    if (inArchive) {
      archiveTopics.push({
        topic,
        description: readColumn(cols, colMap, 'description'),
        version: readColumn(cols, colMap, 'version'),
        latest: readColumn(cols, colMap, 'latest'),
        date: readColumn(cols, colMap, 'date'),
      })
      continue
    }

    topics.push({
      topic,
      status: readColumn(cols, colMap, 'status'),
      stage: readColumn(cols, colMap, 'stage'),
      yggPoint: readColumn(cols, colMap, 'yggPoint'),
      description: readColumn(cols, colMap, 'description'),
      date: readColumn(cols, colMap, 'date'),
    })
  }

  return { topics, archiveTopics }
}

function formatActiveRow(entry: ActiveChangeEntry): string {
  return `| [${entry.topic}](./${entry.topic}/) | ${normalizeCell(entry.status)} | ${normalizeCell(entry.stage)} | ${normalizeCell(entry.yggPoint)} | ${normalizeCell(entry.description)} | ${normalizeCell(entry.date)} |`
}

function formatArchiveRow(entry: ArchiveChangeEntry): string {
  return `| [${entry.topic}](./archive/${entry.topic}/) | ${normalizeCell(entry.description)} | ${normalizeCell(entry.version)} | ${normalizeCell(entry.latest)} | ${normalizeCell(entry.date)} |`
}

export function serializeChangeIndex(model: ParsedChangeIndex): string {
  const lines = [
    '# Change Index',
    '',
    ACTIVE_HEADER,
    ACTIVE_SEPARATOR,
    ...model.topics.map(formatActiveRow),
    '',
    '### Archive',
    ARCHIVE_HEADER,
    ARCHIVE_SEPARATOR,
    ...model.archiveTopics.map(formatArchiveRow),
    '',
  ]

  return lines.join('\n')
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function parseDateValue(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NEGATIVE_INFINITY
  const time = new Date(`${value}T00:00:00`).getTime()
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

function parseSemverValue(value: string): [number, number, number] | null {
  const normalized = value.trim().replace(/^v/i, '')
  const parts = normalized.split('.').map(part => Number.parseInt(part, 10))
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part) || part < 0)) {
    return null
  }
  return parts as [number, number, number]
}

function compareTopics(a: string, b: string): number {
  return a.localeCompare(b)
}

export function sortActiveTopics(topics: ActiveChangeEntry[]): ActiveChangeEntry[] {
  return [...topics].sort((a, b) => {
    const dateDiff = parseDateValue(b.date) - parseDateValue(a.date)
    if (dateDiff !== 0) return dateDiff
    return compareTopics(a.topic, b.topic)
  })
}

export function sortArchiveTopics(topics: ArchiveChangeEntry[]): ArchiveChangeEntry[] {
  return [...topics].sort((a, b) => {
    const versionA = parseSemverValue(a.version)
    const versionB = parseSemverValue(b.version)
    if (versionA && versionB) {
      for (let i = 0; i < 3; i++) {
        const diff = versionB[i] - versionA[i]
        if (diff !== 0) return diff
      }
    } else if (versionA) {
      return -1
    } else if (versionB) {
      return 1
    }

    const dateDiff = parseDateValue(b.date) - parseDateValue(a.date)
    if (dateDiff !== 0) return dateDiff
    return compareTopics(a.topic, b.topic)
  })
}

function stripLatestFlags(topics: ArchiveChangeEntry[]): ArchiveChangeEntry[] {
  return topics.map((topic, index) => ({
    ...topic,
    latest: index === 0 ? 'latest' : '-',
  }))
}

export async function writeChangeIndex(projectRoot: string, model: ParsedChangeIndex): Promise<void> {
  const indexPath = join(projectRoot, 'ygg', 'change', 'INDEX.md')
  const tmpPath = indexPath + '.tmp'
  const normalized: ParsedChangeIndex = {
    topics: sortActiveTopics(model.topics),
    archiveTopics: stripLatestFlags(sortArchiveTopics(model.archiveTopics)),
  }
  await writeFile(tmpPath, serializeChangeIndex(normalized), 'utf-8')
  await rename(tmpPath, indexPath)
}

export async function readChangeIndex(projectRoot: string): Promise<ParsedChangeIndex> {
  const indexPath = join(projectRoot, 'ygg', 'change', 'INDEX.md')
  try {
    const content = await readFile(indexPath, 'utf-8')
    return parseChangeIndex(content)
  } catch {
    return { topics: [], archiveTopics: [] }
  }
}

export async function findLatestTopicDate(topicDir: string): Promise<string | undefined> {
  try {
    const entries = await readdir(topicDir, { withFileTypes: true })
    const datedFiles = entries
      .filter(entry => entry.isFile() && /^\d{4}-\d{2}-\d{2}\.md$/.test(entry.name))
      .map(entry => entry.name.replace(/\.md$/, ''))
      .sort()

    if (datedFiles.length > 0) {
      return datedFiles[datedFiles.length - 1]
    }

    const fallbackFiles = ['proposal.md', 'design.md', 'tasks.md', 'ygg-point.json']
    const fallbackTimes = await Promise.all(
      fallbackFiles.map(async (file) => {
        try {
          const info = await stat(join(topicDir, file))
          return info.mtime
        } catch {
          return null
        }
      }),
    )
    const latest = fallbackTimes
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0]

    if (!latest) return undefined

    const year = latest.getFullYear()
    const month = String(latest.getMonth() + 1).padStart(2, '0')
    const day = String(latest.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return undefined
  }
}

function normalizeArchiveEntry(entry: ArchiveChangeEntry): ArchiveChangeEntry {
  return {
    topic: entry.topic,
    description: normalizeCell(entry.description),
    version: normalizeCell(entry.version),
    latest: normalizeCell(entry.latest),
    date: normalizeCell(entry.date),
  }
}

function normalizeActiveEntry(entry: ActiveChangeEntry): ActiveChangeEntry {
  return {
    topic: entry.topic,
    status: normalizeCell(entry.status),
    stage: normalizeCell(entry.stage),
    yggPoint: normalizeCell(entry.yggPoint),
    description: normalizeCell(entry.description),
    date: normalizeCell(entry.date),
  }
}

export async function syncChangeIndex(projectRoot: string): Promise<SyncChangeIndexResult> {
  const changeDir = resolve(join(projectRoot, 'ygg', 'change'))
  const archiveDir = join(changeDir, 'archive')
  const model = await readChangeIndex(projectRoot)

  const removedArchiveTopics: string[] = []
  const validArchiveTopics: ArchiveChangeEntry[] = []
  const validTopicNames = new Set<string>()

  for (const entry of model.archiveTopics.map(normalizeArchiveEntry)) {
    const archiveTopicDir = resolve(join(archiveDir, entry.topic))
    const exists = await fileExists(archiveTopicDir)
    if (entry.version === '-' || !exists) {
      removedArchiveTopics.push(entry.topic)
      if (exists) {
        await rm(archiveTopicDir, { recursive: true, force: true })
      }
      continue
    }
    validArchiveTopics.push(entry)
    validTopicNames.add(entry.topic)
  }

  const removedOrphanDirs: string[] = []
  try {
    const entries = await readdir(archiveDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (validTopicNames.has(entry.name)) continue
      await rm(join(archiveDir, entry.name), { recursive: true, force: true })
      removedOrphanDirs.push(entry.name)
    }
  } catch {
    // no archive dir yet
  }

  const normalizedTopics = await Promise.all(model.topics.map(async (entry) => {
    const normalized = normalizeActiveEntry(entry)
    const latestDate = await findLatestTopicDate(join(changeDir, normalized.topic))
    if (latestDate) {
      normalized.date = latestDate
    }
    return normalized
  }))

  const nextModel: ParsedChangeIndex = {
    topics: sortActiveTopics(normalizedTopics),
    archiveTopics: stripLatestFlags(sortArchiveTopics(validArchiveTopics)),
  }

  await writeChangeIndex(projectRoot, nextModel)

  return {
    model: nextModel,
    removedArchiveTopics,
    removedOrphanDirs,
  }
}
