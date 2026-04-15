import { readFile, writeFile } from 'node:fs/promises'

import type { FastifyInstance } from 'fastify'

import { loadRegistry, findProject } from '../registry.js'
import { resolveTargetFilePath, type FileType } from '../target-files.js'

export function filesRoutes(app: FastifyInstance): void {
  // GET /api/projects/:id/files/:target/:type/:name
  app.get<{ Params: { id: string; target: string; type: string; name: string } }>(
    '/api/projects/:id/files/:target/:type/:name',
    async (request, reply) => {
      const registry = await loadRegistry()
      const entry = findProject(registry, request.params.id)
      if (!entry) return reply.status(404).send({ error: 'Project not found' })

      const type = request.params.type as FileType
      if (!['skills', 'agents', 'commands'].includes(type)) {
        return reply.status(400).send({ error: 'Invalid file type' })
      }

      const filePath = resolveTargetFilePath(
        entry.path,
        decodeURIComponent(request.params.target),
        type,
        decodeURIComponent(request.params.name),
      )
      if (!filePath) return reply.status(400).send({ error: 'Invalid path' })

      try {
        const content = await readFile(filePath, 'utf-8')
        return { content, path: filePath }
      } catch {
        return reply.status(404).send({ error: 'File not found' })
      }
    },
  )

  // PUT /api/projects/:id/files/:target/:type/:name
  app.put<{ Params: { id: string; target: string; type: string; name: string }; Body: { content: string } }>(
    '/api/projects/:id/files/:target/:type/:name',
    async (request, reply) => {
      const registry = await loadRegistry()
      const entry = findProject(registry, request.params.id)
      if (!entry) return reply.status(404).send({ error: 'Project not found' })

      const type = request.params.type as FileType
      if (!['skills', 'agents', 'commands'].includes(type)) {
        return reply.status(400).send({ error: 'Invalid file type' })
      }

      const filePath = resolveTargetFilePath(
        entry.path,
        decodeURIComponent(request.params.target),
        type,
        decodeURIComponent(request.params.name),
      )
      if (!filePath) return reply.status(400).send({ error: 'Invalid path' })

      const { content } = request.body
      if (typeof content !== 'string') {
        return reply.status(400).send({ error: 'content is required' })
      }

      try {
        await writeFile(filePath, content, 'utf-8')
        return { success: true }
      } catch {
        return reply.status(500).send({ error: 'Failed to write file' })
      }
    },
  )
}
