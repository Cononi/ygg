import { createInterface } from 'node:readline'

import { generateAgent } from '../generators/agent-generator.js'
import { generateCommand } from '../generators/command-generator.js'
import { generateHook } from '../generators/hook-generator.js'
import { generateSkill } from '../generators/skill-generator.js'
import { agentSpecSchema } from '../schemas/agent.schema.js'
import { commandSpecSchema } from '../schemas/command.schema.js'
import { hookSpecSchema } from '../schemas/hook.schema.js'
import type { Plan } from '../schemas/plan.schema.js'
import { skillSpecSchema } from '../schemas/skill.schema.js'
import type { Result } from '../types/index.js'
import { ok, err, GenerateError } from '../types/index.js'
import { safeWriteFile } from '../utils/file-writer.js'
import { logger } from '../utils/logger.js'

export interface GenerateOptions {
  dryRun: boolean
  force: boolean
  interactive: boolean
  projectRoot: string
}

export interface GenerateResult {
  written: string[]
  skipped: string[]
  errors: Array<{ path: string; message: string }>
}

/** Plan을 기반으로 파일을 생성한다 */
export async function executeGenerate(
  plan: Plan,
  options: GenerateOptions,
): Promise<Result<GenerateResult, GenerateError>> {
  const result: GenerateResult = {
    written: [],
    skipped: [],
    errors: [],
  }

  // Hook 엔트리를 모아서 한 번에 처리
  const hookEntries = plan.entries.filter((e) => e.componentType === 'hook')
  const otherEntries = plan.entries.filter((e) => e.componentType !== 'hook')

  // 비TTY 환경에서 --interactive 지정 시 경고
  if (options.interactive && !process.stdin.isTTY) {
    logger.warn('stdin is not a TTY, --interactive ignored (conflicts will be skipped)')
  }

  let interactiveDecision: 'ask' | 'all' | 'skip' = 'ask'

  // 일반 구성요소 처리
  for (const entry of otherEntries) {
    let rendered: string

    // Skill 부속 파일은 content가 이미 최종 내용 (JSON이 아님)
    if (entry.componentType === 'skill' && entry.name.includes('/')) {
      rendered = entry.content
    } else {
      switch (entry.componentType) {
        case 'agent':
          rendered = generateAgent(agentSpecSchema.parse(JSON.parse(entry.content)))
          break
        case 'command':
          rendered = generateCommand(commandSpecSchema.parse(JSON.parse(entry.content)))
          break
        case 'skill':
          rendered = generateSkill(skillSpecSchema.parse(JSON.parse(entry.content)))
          break
        default:
          continue
      }
    }

    if (entry.conflict && !options.force) {
      if (options.interactive && process.stdin.isTTY) {
        if (interactiveDecision === 'skip') {
          result.skipped.push(entry.targetPath)
          continue
        } else if (interactiveDecision === 'ask') {
          logger.warn(`Conflict: ${entry.targetPath}`)
          const answer = await readLine('Overwrite? [y]es / [n]o / [a]ll / [s]kip all > ')
          const trimmed = answer.trim().toLowerCase()
          if (trimmed === 'a') {
            interactiveDecision = 'all'
          } else if (trimmed === 's') {
            interactiveDecision = 'skip'
            result.skipped.push(entry.targetPath)
            continue
          } else if (trimmed !== 'y') {
            result.skipped.push(entry.targetPath)
            continue
          }
          // 'y' 또는 'a' → write 진행
        }
        // interactiveDecision === 'all' → write 진행
      } else {
        logger.warn(`Conflict: ${entry.targetPath} (use --force to overwrite)`)
        result.skipped.push(entry.targetPath)
        continue
      }
    }

    const writeResult = await safeWriteFile(entry.targetPath, rendered, {
      dryRun: options.dryRun,
      force: options.force,
    })

    if (writeResult.ok) {
      result.written.push(entry.targetPath)
    } else {
      result.errors.push({
        path: entry.targetPath,
        message: writeResult.error.message,
      })
    }
  }

  // Hook 엔트리 병합 처리
  if (hookEntries.length > 0) {
    const hookSpecs = hookEntries.map((e) => hookSpecSchema.parse(JSON.parse(e.content)))
    const targetPath = hookEntries[0].targetPath
    const hookResult = await generateHook(hookSpecs, targetPath, {
      dryRun: options.dryRun,
      force: options.force,
    })

    if (hookResult.ok) {
      result.written.push(targetPath)
    } else {
      result.errors.push({
        path: targetPath,
        message: hookResult.error.message,
      })
    }
  }

  if (result.errors.length > 0) {
    return err(
      new GenerateError(
        `${result.errors.length} file(s) failed to generate`,
      ),
    )
  }

  return ok(result)
}

function readLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}
