import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import { parse as parseYaml } from 'yaml'

import type { AgentSpec } from '../schemas/agent.schema.js'
import { agentSpecSchema } from '../schemas/agent.schema.js'
import type { CommandSpec } from '../schemas/command.schema.js'
import { commandSpecSchema } from '../schemas/command.schema.js'
import type { HookSpec } from '../schemas/hook.schema.js'
import { hookSpecSchema } from '../schemas/hook.schema.js'
import type { SkillSpec } from '../schemas/skill.schema.js'
import { skillSpecSchema } from '../schemas/skill.schema.js'
import type { ComponentType, Result } from '../types/index.js'
import { ok, err, SpecParseError } from '../types/index.js'

/** YAML 파일을 읽어서 파싱한다 */
async function readYaml(filePath: string): Promise<Result<unknown, SpecParseError>> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    const ext = extname(filePath)

    if (ext === '.yml' || ext === '.yaml') {
      return ok(parseYaml(raw))
    }

    return err(new SpecParseError(`Unsupported file extension: ${ext}`, filePath))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(new SpecParseError(`Failed to read file: ${message}`, filePath))
  }
}

/** 구성요소 타입을 파일명에서 추론한다 */
export function inferComponentType(filePath: string): ComponentType | null {
  if (filePath.endsWith('.agent.yml') || filePath.endsWith('.agent.yaml')) return 'agent'
  if (filePath.endsWith('.hook.yml') || filePath.endsWith('.hook.yaml')) return 'hook'
  if (filePath.endsWith('.command.yml') || filePath.endsWith('.command.yaml')) return 'command'
  if (filePath.endsWith('.skill.yml') || filePath.endsWith('.skill.yaml')) return 'skill'
  return null
}

/** 구성요소 spec 파일을 파싱한다 */
export async function parseComponentSpec(
  filePath: string,
  componentType?: ComponentType,
): Promise<Result<AgentSpec | HookSpec | CommandSpec | SkillSpec, SpecParseError>> {
  const type = componentType ?? inferComponentType(filePath)
  if (!type) {
    return err(
      new SpecParseError(
        `Cannot infer component type from filename: ${filePath}. Use .agent.yml, .hook.yml, .command.yml, or .skill.yml`,
        filePath,
      ),
    )
  }

  const result = await readYaml(filePath)
  if (!result.ok) return result

  const schemaMap = {
    agent: agentSpecSchema,
    hook: hookSpecSchema,
    command: commandSpecSchema,
    skill: skillSpecSchema,
  } as const

  const schema = schemaMap[type]
  const parsed = schema.safeParse(result.value)

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return err(new SpecParseError(`Invalid ${type} spec: ${issues}`, filePath))
  }

  return ok(parsed.data)
}
