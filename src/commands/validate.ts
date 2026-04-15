import { resolve } from 'node:path'

import { validateOutput } from '../core/validator.js'
import { logger } from '../utils/logger.js'

export interface ValidateOptions {
  target?: string
}

/** validate 커맨드: 생성된 파일이 Claude Code 규약에 맞는지 검증 */
export async function runValidate(projectRoot: string, options: ValidateOptions): Promise<void> {
  const targetDir = resolve(projectRoot, options.target ?? '.claude')
  const result = await validateOutput(targetDir)

  if (result.ok) {
    const { issues } = result.value
    if (issues.length === 0) {
      logger.success('All validations passed')
    } else {
      for (const issue of issues) {
        if (issue.severity === 'warning') {
          logger.warn(`${issue.path}: ${issue.message}`)
        }
      }
      logger.success(`Validation passed with ${issues.length} warning(s)`)
    }
  } else {
    for (const issue of result.error.issues) {
      if (issue.severity === 'error') {
        logger.error(`${issue.path}: ${issue.message}`)
      } else {
        logger.warn(`${issue.path}: ${issue.message}`)
      }
    }
    logger.error('Validation failed')
    process.exitCode = 1
  }
}
