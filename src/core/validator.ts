import { readFile } from 'node:fs/promises'

import type { Result, ValidationIssue } from '../types/index.js'
import { ok, err, ValidationError } from '../types/index.js'
import { fileExists } from '../utils/file-writer.js'
import { parseFrontmatter } from '../utils/frontmatter.js'

export interface ValidateResult {
  valid: boolean
  issues: ValidationIssue[]
}

/** 생성된 파일이 Claude Code 규약에 맞는지 검증한다 */
export async function validateOutput(targetDir: string): Promise<Result<ValidateResult, ValidationError>> {
  const issues: ValidationIssue[] = []

  // Agent 파일 검증
  const agentIssues = await validateAgents(targetDir)
  issues.push(...agentIssues)

  // settings.json (hooks) 검증
  const hookIssues = await validateHooks(targetDir)
  issues.push(...hookIssues)

  // Command 파일 검증
  const commandIssues = await validateCommands(targetDir)
  issues.push(...commandIssues)

  // Skill 파일 검증
  const skillIssues = await validateSkills(targetDir)
  issues.push(...skillIssues)

  const hasErrors = issues.some((i) => i.severity === 'error')

  if (hasErrors) {
    return err(new ValidationError('Validation failed', issues))
  }

  return ok({ valid: true, issues })
}

async function validateAgents(targetDir: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const agentsDir = `${targetDir}/agents`

  if (!(await fileExists(agentsDir))) return issues

  const { glob } = await import('glob')
  const files = await glob('*.md', { cwd: agentsDir })

  for (const file of files) {
    const filePath = `${agentsDir}/${file}`
    const content = await readFile(filePath, 'utf-8')
    const { data } = parseFrontmatter(content)

    if (!data || typeof data !== 'object') {
      issues.push({
        path: filePath,
        message: 'Agent file missing frontmatter',
        severity: 'error',
      })
      continue
    }

    const record = data
    if (!record['name']) {
      issues.push({
        path: filePath,
        message: 'Agent frontmatter missing required field: name',
        severity: 'error',
      })
    }
    if (!record['description']) {
      issues.push({
        path: filePath,
        message: 'Agent frontmatter missing required field: description',
        severity: 'error',
      })
    }
  }

  return issues
}

async function validateHooks(targetDir: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const settingsPath = `${targetDir}/settings.json`

  if (!(await fileExists(settingsPath))) return issues

  try {
    const content = await readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(content) as Record<string, unknown>

    if (settings['hooks'] && typeof settings['hooks'] === 'object') {
      const hooks = settings['hooks'] as Record<string, unknown>
      const { hookEventName } = await import('../schemas/shared.schema.js')
      const validEvents: Set<string> = new Set(hookEventName.options)

      for (const event of Object.keys(hooks)) {
        if (!validEvents.has(event)) {
          issues.push({
            path: settingsPath,
            message: `Invalid hook event: ${event}`,
            severity: 'error',
          })
        }
      }
    }
  } catch {
    issues.push({
      path: settingsPath,
      message: 'Invalid JSON in settings.json',
      severity: 'error',
    })
  }

  return issues
}

async function validateCommands(targetDir: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const commandsDir = `${targetDir}/commands`

  if (!(await fileExists(commandsDir))) return issues

  const { glob } = await import('glob')
  const files = await glob('*.md', { cwd: commandsDir })

  for (const file of files) {
    const filePath = `${commandsDir}/${file}`
    const content = await readFile(filePath, 'utf-8')

    if (content.trim().length === 0) {
      issues.push({
        path: filePath,
        message: 'Command file is empty',
        severity: 'error',
      })
    }
  }

  return issues
}

async function validateSkills(targetDir: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const skillsDir = `${targetDir}/skills`

  if (!(await fileExists(skillsDir))) return issues

  const { glob } = await import('glob')
  const dirs = await glob('*', { cwd: skillsDir })

  for (const dir of dirs) {
    const skillMdPath = `${skillsDir}/${dir}/SKILL.md`

    if (!(await fileExists(skillMdPath))) {
      issues.push({
        path: `${skillsDir}/${dir}`,
        message: `Skill directory missing SKILL.md: ${dir}`,
        severity: 'error',
      })
      continue
    }

    const content = await readFile(skillMdPath, 'utf-8')

    if (!content.includes('name:') && !content.includes('# ')) {
      issues.push({
        path: skillMdPath,
        message: 'SKILL.md missing name metadata or heading',
        severity: 'warning',
      })
    }
  }

  return issues
}
