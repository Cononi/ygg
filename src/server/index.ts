import { dirname, extname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

import { changesRoutes } from './routes/changes.js'
import { filesRoutes } from './routes/files.js'
import { projectsRoutes } from './routes/projects.js'
import { versionRoutes } from './routes/version.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const packageRoot = __dir.includes(`${sep}src${sep}`) ? join(__dir, '../..') : join(__dir, '..')
const DASHBOARD_DIST = join(packageRoot, 'dist', 'dashboard')

export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  // API 라우트 등록 (static 보다 먼저)
  await app.register(versionRoutes)
  await app.register(projectsRoutes)
  await app.register(filesRoutes)
  await app.register(changesRoutes)

  // React SPA static serve
  await app.register(fastifyStatic, {
    root: DASHBOARD_DIST,
    prefix: '/',
  })

  // SPA fallback: /api/* 가 아닌 모든 경로 → index.html
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found' })
    }
    return reply.sendFile('index.html', DASHBOARD_DIST)
  })

  // Content-Type for API responses
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.header('Content-Type', 'application/json; charset=utf-8')
      return
    }

    const pathname = request.url.split('?')[0] ?? ''
    const extension = extname(pathname)

    if (extension === '.js' || extension === '.css') {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable')
      return
    }

    // Prevent browsers from pinning an older SPA shell after dashboard updates.
    if (extension === '.html' || extension === '') {
      reply.header('Cache-Control', 'no-store, max-age=0, must-revalidate')
    }
  })

  return app
}

export type { FastifyInstance }
