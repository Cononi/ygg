import { readFile } from 'node:fs/promises'

import { deepmerge } from 'deepmerge-ts'

import type { HookSpec } from '../schemas/hook.schema.js'
import type { Result , GenerateError } from '../types/index.js'
import { fileExists, safeWriteFile } from '../utils/file-writer.js'
import { logger } from '../utils/logger.js'

interface HookHandler {
  type: string
  command: string
}

interface HookGroup {
  matcher?: string
  hooks: HookHandler[]
}

interface SettingsJson {
  hooks?: Record<string, HookGroup[]>
  [key: string]: unknown
}

/** Hook spec 목록을 settings.json에 병합하여 생성한다 */
export async function generateHook(
  specs: HookSpec[],
  targetPath: string,
  options: { dryRun?: boolean; force?: boolean } = {},
): Promise<Result<string, GenerateError>> {
  // 기존 settings.json 읽기
  let existing: SettingsJson = {}
  if (await fileExists(targetPath)) {
    try {
      const content = await readFile(targetPath, 'utf-8')
      existing = JSON.parse(content) as SettingsJson
    } catch {
      logger.warn(`Could not parse existing settings.json, will create new`)
    }
  }

  // 모든 hook spec을 하나의 hooks 객체로 변환 (Claude Code 규격: { matcher?, hooks: [{type, command}] })
  const newHooks: Record<string, HookGroup[]> = {}

  for (const spec of specs) {
    for (const [event, handlers] of Object.entries(spec.events)) {
      if (!newHooks[event]) {
        newHooks[event] = []
      }
      for (const handler of handlers) {
        const group: HookGroup = {
          ...(handler.matcher ? { matcher: handler.matcher } : {}),
          hooks: [{ type: handler.type, command: handler.command }],
        }
        newHooks[event].push(group)
      }
    }
  }

  // 기존 hooks와 병합 (덮어쓰지 않고 합침)
  const merged = deepmerge(existing, { hooks: newHooks }) as SettingsJson
  const content = JSON.stringify(merged, null, 2) + '\n'

  return safeWriteFile(targetPath, content, {
    dryRun: options.dryRun,
    force: true, // hooks는 항상 병합이므로 force
  })
}

/** 단일 hook spec을 settings.json hooks 섹션 형태로 변환한다 (Claude Code 규격) */
export function hookSpecToSettings(spec: HookSpec): SettingsJson {
  const hooks: SettingsJson['hooks'] = {}

  for (const [event, handlers] of Object.entries(spec.events)) {
    hooks[event] = handlers.map((h): HookGroup => ({
      ...(h.matcher ? { matcher: h.matcher } : {}),
      hooks: [{ type: h.type, command: h.command }],
    }))
  }

  return { hooks }
}
