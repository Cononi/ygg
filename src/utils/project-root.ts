import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))

/** dev: src/utils/ → ../../ = project root | prod: dist/ → ../ = project root */
const PACKAGE_ROOT = __dir.includes(`${sep}src${sep}`)
  ? join(__dir, '../..')
  : join(__dir, '..')

export function getPackageRoot(): string {
  return PACKAGE_ROOT
}

export function resolveDashboardProjectRoot(getCwd: () => string = () => process.cwd()): string {
  try {
    return getCwd()
  } catch (error) {
    if (isInvalidCwdError(error)) {
      return PACKAGE_ROOT
    }
    throw error
  }
}

function isInvalidCwdError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const nodeError = error as NodeJS.ErrnoException
  return nodeError.code === 'ENOENT' || error.message.includes('uv_cwd')
}
