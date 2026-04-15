import type { AgentSpec } from '../schemas/agent.schema.js'
import { stringifyFrontmatter } from '../utils/frontmatter.js'

/** Agent spec으로부터 .md 파일 내용을 생성한다 */
export function generateAgent(spec: AgentSpec): string {
  const frontmatter: Record<string, unknown> = {
    name: spec.name,
    description: spec.description,
  }

  const optionalFields: [string, unknown, unknown?][] = [
    ['model', spec.model],
    ['tools', spec.tools, [] as string[]],
    ['permissions', spec.permissions, 'default'],
    ['memory', spec.memory, 'none'],
    ['hooks', spec.hooks],
    ['skills', spec.skills, [] as string[]],
  ]

  for (const [key, value, defaultVal] of optionalFields) {
    if (value === undefined || value === null) continue
    if (Array.isArray(defaultVal) && Array.isArray(value) && value.length === 0) continue
    if (defaultVal !== undefined && value === defaultVal) continue
    frontmatter[key] = value
  }

  return stringifyFrontmatter(frontmatter, spec.prompt)
}
