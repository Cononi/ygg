/** 공유 타입 정의 */

/** Result 패턴: throw 대신 반환값으로 에러 전달 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

/** 커스텀 에러 클래스 */
export class SpecParseError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly line?: number,
  ) {
    super(message)
    this.name = 'SpecParseError'
  }
}

export class PlanBuildError extends Error {
  constructor(
    message: string,
    public readonly details?: string,
  ) {
    super(message)
    this.name = 'PlanBuildError'
  }
}

export class GenerateError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
  ) {
    super(message)
    this.name = 'GenerateError'
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: ValidationIssue[] = [],
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export interface ValidationIssue {
  path: string
  message: string
  severity: 'error' | 'warning'
}

/** 구성요소 타입 */
export type ComponentType = 'agent' | 'hook' | 'command' | 'skill'

/** 스코프 */
export type Scope = 'project' | 'user'

/** Hook 이벤트 타입 */
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'PermissionRequest'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Notification'
  | 'PreCompact'
  | 'Setup'
  | 'Elicitation'
  | 'ElicitationResult'

/** Hook 핸들러 정의 */
export interface HookHandler {
  matcher?: string
  type: 'command'
  command: string
}

/** Plan 엔트리 */
export interface PlanEntry {
  componentType: ComponentType
  name: string
  targetPath: string
  content: string
  hash: string
  conflict: boolean
  existingHash?: string
}

/** 생성 컨텍스트 */
export interface GenerateContext {
  projectRoot: string
  targetDir: string
  scope: Scope
  dryRun: boolean
  force: boolean
}

/** Generator 인터페이스 */
export interface Generator<TSpec, TOutput> {
  validate(spec: TSpec): Result<TSpec, ValidationError>
  plan(spec: TSpec, context: GenerateContext): PlanEntry[]
  generate(plan: PlanEntry[]): Result<TOutput[], GenerateError>
}
