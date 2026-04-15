import type { AgentSpec } from '../schemas/agent.schema.js'
import type { CommandSpec } from '../schemas/command.schema.js'
import type { HookSpec } from '../schemas/hook.schema.js'
import type { Plan } from '../schemas/plan.schema.js'
import type { SkillSpec } from '../schemas/skill.schema.js'
import type { ComponentType, PlanEntry, Result } from '../types/index.js'
import { ok, err, PlanBuildError } from '../types/index.js'
import { computeHash, getExistingHash } from '../utils/file-writer.js'
import { resolveTargetPath, resolveSupplementaryPath } from '../utils/paths.js'

import { parseComponentSpec } from './spec-parser.js'

/** 단일 구성요소의 plan entry를 생성한다 */
async function buildComponentEntries(
  type: ComponentType,
  spec: AgentSpec | HookSpec | CommandSpec | SkillSpec,
  scope: 'project' | 'user',
  projectRoot: string,
  targetDir: string,
): Promise<PlanEntry[]> {
  const entries: PlanEntry[] = []
  const name = spec.name
  const targetPath = resolveTargetPath(type, name, scope, projectRoot, targetDir)

  // 메인 엔트리를 위한 내용은 generate 단계에서 렌더링하므로 여기서는 placeholder
  const content = JSON.stringify(spec, null, 2)
  const hash = computeHash(content)
  const existingHash = await getExistingHash(targetPath)

  entries.push({
    componentType: type,
    name,
    targetPath,
    content,
    hash,
    conflict: existingHash !== undefined && existingHash !== hash,
    existingHash,
  })

  // Skill의 부속 파일
  if (type === 'skill' && 'supplementary_files' in spec && spec.supplementary_files) {
    for (const file of spec.supplementary_files) {
      const suppPath = resolveSupplementaryPath(name, file.path, scope, projectRoot, targetDir)
      const suppHash = computeHash(file.content)
      const suppExistingHash = await getExistingHash(suppPath)

      entries.push({
        componentType: 'skill',
        name: `${name}/${file.path}`,
        targetPath: suppPath,
        content: file.content,
        hash: suppHash,
        conflict: suppExistingHash !== undefined && suppExistingHash !== suppHash,
        existingHash: suppExistingHash,
      })
    }
  }

  return entries
}

/** 단일 spec 파일로부터 plan을 빌드한다 */
export async function buildSinglePlan(
  specPath: string,
  projectRoot: string,
  targetDir: string = '.claude',
): Promise<Result<Plan, PlanBuildError>> {
  const result = await parseComponentSpec(specPath)
  if (!result.ok) {
    return err(new PlanBuildError(`Failed to parse ${specPath}: ${result.error.message}`))
  }

  const spec = result.value
  const type = inferTypeFromSpec(spec)
  const scope = 'scope' in spec ? spec.scope ?? 'project' : 'project'

  const entries = await buildComponentEntries(type, spec, scope, projectRoot, targetDir)

  return ok({
    version: '1',
    projectName: 'single',
    entries,
    createdAt: new Date().toISOString(),
  })
}

function inferTypeFromSpec(spec: AgentSpec | HookSpec | CommandSpec | SkillSpec): ComponentType {
  if ('prompt' in spec && 'events' in spec === false && 'content' in spec === false) {
    if ('tools' in spec || 'permissions' in spec || 'memory' in spec) return 'agent'
    return 'command'
  }
  if ('events' in spec) return 'hook'
  if ('content' in spec) return 'skill'
  return 'agent'
}
