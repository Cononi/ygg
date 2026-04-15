import type { SkillSpec } from '../schemas/skill.schema.js'
import { stringifyFrontmatter } from '../utils/frontmatter.js'

/** Skill spec으로부터 SKILL.md 파일 내용을 생성한다 */
export function generateSkill(spec: SkillSpec): string {
  const frontmatter: Record<string, unknown> = {
    name: spec.name,
    description: spec.description,
  }

  if (spec.allowed_tools && spec.allowed_tools.length > 0) {
    frontmatter['allowed_tools'] = spec.allowed_tools
  }

  return stringifyFrontmatter(frontmatter, spec.content.trim())
}
