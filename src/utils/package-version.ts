import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))

/** dev: src/utils/ → ../../ = project root | prod: dist/ → ../ = project root */
const PACKAGE_ROOT = __dir.includes(`${sep}src${sep}`)
  ? join(__dir, '../..')
  : join(__dir, '..')

const _require = createRequire(import.meta.url)

/** 현재 ygg 패키지 버전을 반환한다. dev/prod 환경 모두에서 올바른 경로를 사용한다. */
export function getPackageVersion(): string {
  const pkg = _require(join(PACKAGE_ROOT, 'package.json')) as { version: string }
  return pkg.version
}
