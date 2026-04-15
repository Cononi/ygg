import { z } from 'zod'

import { hookHandlerSchema, hookEventName } from './shared.schema.js'

export const hookSpecSchema = z.object({
  name: z.string().min(1, 'Hook name is required'),
  description: z.string().min(1, 'Hook description is required'),
  scope: z.enum(['project', 'user']).default('project'),
  events: z.record(hookEventName, z.array(hookHandlerSchema)),
})

export type HookSpec = z.infer<typeof hookSpecSchema>
