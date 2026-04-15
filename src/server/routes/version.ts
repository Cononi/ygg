import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { FastifyInstance } from 'fastify'

const __dir = dirname(fileURLToPath(import.meta.url))
const packageRoot = __dir.includes(`${sep}src${sep}`) ? join(__dir, '../../..') : join(__dir, '..')
const require = createRequire(import.meta.url)
const pkg = require(join(packageRoot, 'package.json')) as { version: string }

export function versionRoutes(app: FastifyInstance): void {
  app.get('/api/version', () => {
    return { version: pkg.version }
  })
}
