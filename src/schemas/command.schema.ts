import { z } from 'zod'

export const commandSpecSchema = z.object({
  name: z.string().min(1, 'Command name is required'),
  description: z.string().min(1, 'Command description is required'),
  scope: z.enum(['project', 'user']).default('project'),
  prompt: z.string().min(1, 'Command prompt is required'),
  depends_on: z
    .object({
      agents: z.array(z.string()).optional(),
    })
    .optional(),
})

export type CommandSpec = z.infer<typeof commandSpecSchema>
