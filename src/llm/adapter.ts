/** LLM 어댑터 인터페이스 — 위임 가능한 텍스트 생성 작업의 추상화 */

export interface CompleteOptions {
  maxTokens?: number
  temperature?: number
}

export interface LlmAdapter {
  complete(prompt: string, opts?: CompleteOptions): Promise<string>
}

export class LlmAdapterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'LlmAdapterError'
  }
}
