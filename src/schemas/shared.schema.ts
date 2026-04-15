import { z } from 'zod'

export const hookHandlerSchema = z.object({
  matcher: z.string().optional(),
  type: z.literal('command'),
  command: z.string().min(1),
})

export const hookEventName = z.enum([
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'Notification',
  'PreCompact',
  'Setup',
  'Elicitation',
  'ElicitationResult',
])

export type HookHandler = z.infer<typeof hookHandlerSchema>
export type HookEventName = z.infer<typeof hookEventName>
