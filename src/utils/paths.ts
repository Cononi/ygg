import { homedir } from 'node:os'
import { join } from 'node:path'

import type { ComponentType, Scope } from '../types/index.js'

/**
 * Claude Code 경로 규약에 따른 출력 경로 계산
 *
 * | 구성요소 | Project Scope             | User Scope                     |
 * |----------|---------------------------|--------------------------------|
 * | Agent    | .claude/agents/<name>.md  | ~/.claude/agents/<name>.md     |
 * | Hook     | .claude/settings.json     | ~/.claude/settings.json        |
 * | Command  | .claude/commands/<name>.md| ~/.claude/commands/<name>.md   |
 * | Skill    | .claude/skills/<name>/SKILL.md | ~/.claude/skills/<name>/SKILL.md |
 */
export function resolveTargetPath(
  componentType: ComponentType,
  name: string,
  scope: Scope,
  projectRoot: string,
  targetDir: string = '.claude',
): string {
  const baseDir = scope === 'user' ? join(homedir(), '.claude') : join(projectRoot, targetDir)

  switch (componentType) {
    case 'agent':
      return join(baseDir, 'agents', `${name}.md`)
    case 'hook':
      return join(baseDir, 'settings.json')
    case 'command':
      return join(baseDir, 'commands', `${name}.md`)
    case 'skill':
      return join(baseDir, 'skills', name, 'SKILL.md')
  }
}

/** Skill 부속 파일의 경로를 계산한다 */
export function resolveSupplementaryPath(
  skillName: string,
  filePath: string,
  scope: Scope,
  projectRoot: string,
  targetDir: string = '.claude',
): string {
  const baseDir = scope === 'user' ? join(homedir(), '.claude') : join(projectRoot, targetDir)
  return join(baseDir, 'skills', skillName, filePath)
}
