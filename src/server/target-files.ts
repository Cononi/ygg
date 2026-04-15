import { readdir, stat } from 'node:fs/promises'
import { join, normalize, resolve, sep } from 'node:path'

import { AGENT_DOC_FILENAMES } from '../commands/init.js'
import { readConfigTargetNames } from '../i18n/config.js'
import { fileExists } from '../utils/file-writer.js'

export type FileType = 'skills' | 'agents' | 'commands'

export interface FileCollections {
  skills: string[]
  agents: string[]
  commands: string[]
}

export interface TargetFileSource {
  target: string
  label: string
  files: FileCollections
}

type TargetFileResolver = {
  label: string
  listFiles(projectPath: string): Promise<FileCollections>
  resolveFilePath(projectPath: string, type: FileType, name: string): string | null
}

const TARGET_FILE_RESOLVERS: Record<string, TargetFileResolver> = {
  claude: {
    label: 'Claude Code',
    async listFiles(projectPath: string): Promise<FileCollections> {
      const claudeDir = join(projectPath, '.claude')
      const [skills, agents, commands] = await Promise.all([
        listSkills(join(claudeDir, 'skills')),
        listMarkdownFiles(join(claudeDir, 'agents')),
        listCommandFiles(join(claudeDir, 'commands')),
      ])
      return { skills, agents, commands }
    },
    resolveFilePath(projectPath: string, type: FileType, name: string): string | null {
      const claudeDir = join(projectPath, '.claude')
      if (type === 'skills') return safeResolve(projectPath, join(claudeDir, 'skills', name, 'SKILL.md'))
      if (type === 'agents') return safeResolve(projectPath, join(claudeDir, 'agents', `${name}.md`))
      return safeResolve(projectPath, join(claudeDir, 'commands', `${name}.md`))
    },
  },
  codex: {
    label: 'Codex',
    async listFiles(projectPath: string): Promise<FileCollections> {
      const codexSkillsDir = join(projectPath, '.codex', 'skills')
      const skills = await listSkills(codexSkillsDir)
      const agents = await fileExists(join(projectPath, AGENT_DOC_FILENAMES.codex)) ? ['AGENTS'] : []
      return { skills, agents, commands: [] }
    },
    resolveFilePath(projectPath: string, type: FileType, name: string): string | null {
      if (type === 'skills') return safeResolve(projectPath, join(projectPath, '.codex', 'skills', name, 'SKILL.md'))
      if (type === 'agents' && name === 'AGENTS') return safeResolve(projectPath, join(projectPath, AGENT_DOC_FILENAMES.codex))
      return null
    },
  },
}

export async function discoverProjectTargets(projectPath: string): Promise<string[]> {
  const configured = await readConfigTargetNames(projectPath) ?? []
  const discovered = [...configured]

  if (await hasClaudeTarget(projectPath) && !discovered.includes('claude')) {
    discovered.push('claude')
  }
  if (await hasCodexTarget(projectPath) && !discovered.includes('codex')) {
    discovered.push('codex')
  }

  return discovered
}

export async function listTargetFileSources(projectPath: string): Promise<TargetFileSource[]> {
  const targets = await discoverProjectTargets(projectPath)

  return Promise.all(targets.map(async target => {
    const resolver = TARGET_FILE_RESOLVERS[target]
    const files = resolver ? await resolver.listFiles(projectPath) : emptyFileCollections()
    return {
      target,
      label: resolver?.label ?? humanizeTargetName(target),
      files,
    }
  }))
}

export function resolveTargetFilePath(
  projectPath: string,
  target: string,
  type: FileType,
  name: string,
): string | null {
  const resolver = TARGET_FILE_RESOLVERS[target]
  if (!resolver) {
    return null
  }
  return resolver.resolveFilePath(projectPath, type, name)
}

function emptyFileCollections(): FileCollections {
  return { skills: [], agents: [], commands: [] }
}

function humanizeTargetName(target: string): string {
  return target
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || target
}

async function hasClaudeTarget(projectPath: string): Promise<boolean> {
  const hasClaudeDir = await fileExists(join(projectPath, '.claude'))
  if (hasClaudeDir) return true
  return fileExists(join(projectPath, AGENT_DOC_FILENAMES.claude))
}

async function hasCodexTarget(projectPath: string): Promise<boolean> {
  const hasCodexDir = await fileExists(join(projectPath, '.codex'))
  if (hasCodexDir) return true
  return fileExists(join(projectPath, AGENT_DOC_FILENAMES.codex))
}

function safeResolve(projectPath: string, filePath: string): string | null {
  const normalized = normalize(resolve(filePath))
  const base = normalize(resolve(projectPath))
  if (!normalized.startsWith(base + sep) && normalized !== base) {
    return null
  }
  return filePath
}

async function listSkills(skillsDir: string): Promise<string[]> {
  try {
    const dirs = await readdir(skillsDir)
    const result: string[] = []
    for (const dir of dirs) {
      const skillPath = join(skillsDir, dir)
      const entry = await stat(skillPath)
      if (entry.isDirectory()) {
        result.push(dir)
      }
    }
    return result
  } catch {
    return []
  }
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir)
    return entries.filter(entry => entry.endsWith('.md')).map(entry => entry.replace(/\.md$/, ''))
  } catch {
    return []
  }
}

async function listCommandFiles(commandsDir: string): Promise<string[]> {
  try {
    const { glob } = await import('glob')
    const files = await glob('**/*.md', { cwd: commandsDir })
    return files.map(file => file.replace(/\.md$/, ''))
  } catch {
    return []
  }
}
