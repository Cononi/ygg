import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { Result } from '../types/index.js'
import { ok, err, GenerateError } from '../types/index.js'

import { logger } from './logger.js'

/** 파일 내용의 SHA-256 해시를 계산한다 */
export function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16)
}

/** 파일 존재 여부를 확인한다 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/** 기존 파일의 해시를 반환한다. 파일이 없으면 undefined */
export async function getExistingHash(filePath: string): Promise<string | undefined> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return computeHash(content)
  } catch {
    return undefined
  }
}

/** 안전하게 파일을 쓴다. dry-run 모드에서는 쓰지 않는다 */
export async function safeWriteFile(
  filePath: string,
  content: string,
  options: { dryRun?: boolean; force?: boolean } = {},
): Promise<Result<string, GenerateError>> {
  const { dryRun = false, force = false } = options

  if (dryRun) {
    logger.verbose(`[dry-run] Would write: ${filePath}`)
    return ok(filePath)
  }

  const exists = await fileExists(filePath)
  if (exists && !force) {
    const existing = await readFile(filePath, 'utf-8')
    const existingHash = computeHash(existing)
    const newHash = computeHash(content)

    if (existingHash === newHash) {
      logger.verbose(`Unchanged: ${filePath}`)
      return ok(filePath)
    }

    return err(
      new GenerateError(
        `File already exists and differs: ${filePath}. Use --force to overwrite.`,
        filePath,
      ),
    )
  }

  try {
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
    logger.success(`Written: ${filePath}`)
    return ok(filePath)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(new GenerateError(`Failed to write ${filePath}: ${message}`, filePath))
  }
}
