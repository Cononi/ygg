import { z } from 'zod'

import { hookHandlerSchema } from './shared.schema.js'

export const agentSpecSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  description: z.string().min(1, 'Agent description is required'),
  scope: z.enum(['project', 'user']).default('project'),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  permissions: z.enum(['default', 'bypassPermissions']).default('default'),
  memory: z.enum(['none', 'user', 'project']).default('none'),
  hooks: z
    .object({
      PreToolUse: z.array(hookHandlerSchema).optional(),
      PostToolUse: z.array(hookHandlerSchema).optional(),
      PostToolUseFailure: z.array(hookHandlerSchema).optional(),
      Stop: z.array(hookHandlerSchema).optional(),
    })
    .optional(),
  skills: z.array(z.string()).optional(),
  prompt: z.string().min(1, 'Agent prompt is required'),
})

export type AgentSpec = z.infer<typeof agentSpecSchema>
