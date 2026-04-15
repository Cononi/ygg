import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

export interface ParsedFrontmatter<T = Record<string, unknown>> {
  data: T
  body: string
}

/**
 * YAML frontmatter가 포함된 문서를 파싱한다.
 * ---로 구분된 YAML 헤더와 본문을 분리하여 반환한다.
 */
export function parseFrontmatter<T = Record<string, unknown>>(content: string): ParsedFrontmatter<T> {
  const trimmed = content.trim()

  if (!trimmed.startsWith('---')) {
    return { data: {} as T, body: trimmed }
  }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) {
    return { data: {} as T, body: trimmed }
  }

  const yamlBlock = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 3).trim()
  const data = parseYaml(yamlBlock) as T

  return { data, body }
}

/**
 * 데이터와 본문을 YAML frontmatter 형식으로 결합한다.
 */
export function stringifyFrontmatter<T extends Record<string, unknown>>(
  data: T,
  body: string,
): string {
  const yamlStr = stringifyYaml(data, { lineWidth: 0 }).trim()
  return `---\n${yamlStr}\n---\n\n${body}\n`
}
