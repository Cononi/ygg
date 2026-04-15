import type { CommandSpec } from '../schemas/command.schema.js'

/** Command spec으로부터 slash command .md 파일 내용을 생성한다 */
export function generateCommand(spec: CommandSpec): string {
  const lines: string[] = []

  // Command description as comment
  lines.push(spec.prompt)

  return lines.join('\n').trim() + '\n'
}
