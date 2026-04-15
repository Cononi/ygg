import type { CompleteOptions, LlmAdapter } from './adapter.js'
import { LlmAdapterError } from './adapter.js'

const DEFAULT_TIMEOUT_MS = 60_000
const HEALTH_TIMEOUT_MS = 5_000

export interface LmStudioProviderOptions {
  baseUrl: string
  model: string
  timeoutMs?: number
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

/**
 * LM Studio Anthropic 호환 엔드포인트(/v1/chat/completions)를 사용하는 LLM 어댑터.
 * ygg:add 코드 생성 위임에 사용된다.
 */
export class LmStudioProvider implements LlmAdapter {
  constructor(private readonly opts: LmStudioProviderOptions) {}

  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    const url = `${this.opts.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`
    const body = {
      model: this.opts.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.2,
      stream: false,
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer lmstudio',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new LlmAdapterError(
          'LLM_TIMEOUT',
          `LM Studio request timed out after ${this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`,
        )
      }
      throw new LlmAdapterError(
        'LLM_NETWORK_ERROR',
        `LM Studio fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      )
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      const text = await safeReadText(res)
      throw new LlmAdapterError('LLM_HTTP_ERROR', `LM Studio returned HTTP ${res.status}: ${text}`)
    }

    let parsed: ChatCompletionResponse
    try {
      parsed = (await res.json()) as ChatCompletionResponse
    } catch (e) {
      throw new LlmAdapterError(
        'LLM_PARSE_ERROR',
        `Failed to parse LM Studio JSON: ${e instanceof Error ? e.message : String(e)}`,
      )
    }

    const content = parsed.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length === 0) {
      throw new LlmAdapterError(
        'LLM_EMPTY_RESPONSE',
        'LM Studio returned no content in choices[0].message.content',
      )
    }
    return content
  }
}

/**
 * LM Studio 서버 생존 확인 (GET /v1/models).
 * 기본 타임아웃 5초.
 */
export async function checkLmStudioHealth(baseUrl: string, timeoutMs = HEALTH_TIMEOUT_MS): Promise<boolean> {
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/models`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return '<unreadable body>'
  }
}
