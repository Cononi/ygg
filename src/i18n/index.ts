import { readConfigLang } from './config.js'
import { en } from './en.js'
import { ko } from './ko.js'
import type { Messages, SupportedLang } from './types.js'

export type { Messages, SupportedLang }
export { readConfigLang, readConfigTargets, writeConfigLang, writeConfigTargets } from './config.js'

const locales: Record<string, Messages> = { ko, en }

/** 지원하는 언어 목록 */
export const SUPPORTED_LANGS: SupportedLang[] = ['ko', 'en']

/** 시스템 로케일에서 언어 코드를 추출한다 */
export function detectLocale(): string | undefined {
  const lang = process.env['LANG'] ?? process.env['LC_ALL'] ?? process.env['LC_MESSAGES']
  if (!lang) return undefined

  // "ko_KR.UTF-8" → "ko", "en_US" → "en"
  const code = lang.split(/[_.]/)[0]
  if (code && code in locales) {
    return code
  }
  return undefined
}

/**
 * 언어 결정 체인: config.yml → 시스템 로케일 → en
 * 비동기 해소 후 lang 문자열을 반환한다.
 */
export async function resolveLanguage(projectRoot: string): Promise<string> {
  const configLang = await readConfigLang(projectRoot)
  if (configLang && configLang in locales) return configLang

  const localeLang = detectLocale()
  if (localeLang) return localeLang

  return 'en'
}
