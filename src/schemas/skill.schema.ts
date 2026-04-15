import { z } from 'zod'

const supplementaryFileSchema = z.object({
  path: z.string().min(1),
  content: z.string().min(1),
})

export const skillSpecSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  description: z.string().min(1, 'Skill description is required'),
  allowed_tools: z.array(z.string()).optional(),
  content: z.string().min(1, 'Skill content is required'),
  supplementary_files: z.array(supplementaryFileSchema).optional(),
})

export type SkillSpec = z.infer<typeof skillSpecSchema>
