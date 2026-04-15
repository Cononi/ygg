/** i18n 타입 정의 */

/** 지원 언어 */
export type SupportedLang = 'ko' | 'en'

/** 커맨드 메시지 */
export interface CommandMessage {
  readonly description: string
  readonly [key: string]: string
}

/** 스킬 메시지 — 공통 필드 + 선택적 필드 */
export interface SkillMessage {
  readonly description: string
  readonly [key: string]: string
}

/** 전체 메시지 구조 */
export interface Messages {
  readonly commands: {
    readonly create: CommandMessage
    readonly next: CommandMessage
    readonly add: CommandMessage
    readonly qa: CommandMessage
    readonly status: CommandMessage
    readonly prove: CommandMessage
    readonly lang: CommandMessage
  }
  readonly skills: {
    readonly create: SkillMessage
    readonly next: SkillMessage
    readonly add: SkillMessage
    readonly qa: SkillMessage
    readonly status: SkillMessage
    readonly prove: SkillMessage
    readonly lang: SkillMessage
    readonly core: SkillMessage
  }
}
