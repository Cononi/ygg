import { z } from 'zod'

export const planEntrySchema = z.object({
  componentType: z.enum(['agent', 'hook', 'command', 'skill']),
  name: z.string().min(1),
  targetPath: z.string().min(1),
  content: z.string(),
  hash: z.string(),
  conflict: z.boolean().default(false),
  existingHash: z.string().optional(),
})

export const planSchema = z.object({
  version: z.string().default('1'),
  projectName: z.string(),
  entries: z.array(planEntrySchema),
  createdAt: z.string(),
})

export type Plan = z.infer<typeof planSchema>
export type PlanEntryData = z.infer<typeof planEntrySchema>
