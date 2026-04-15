import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LlmAdapterError } from '../../../src/llm/adapter.js'
import { LmStudioProvider, checkLmStudioHealth } from '../../../src/llm/lm-studio-provider.js'

const BASE_URL = 'http://localhost:1234'
const MODEL = 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit'

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeChatResponse(content: string): Response {
  return makeResponse({
    choices: [{ message: { content } }],
  })
}

describe('LmStudioProvider.complete', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('정상 응답 → content 반환', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeChatResponse('const x = 1;'))
    const provider = new LmStudioProvider({ baseUrl: BASE_URL, model: MODEL })
    const result = await provider.complete('write code')
    expect(result).toBe('const x = 1;')
  })

  it('올바른 엔드포인트로 POST 요청', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeChatResponse('ok'))
    const provider = new LmStudioProvider({ baseUrl: BASE_URL, model: MODEL })
    await provider.complete('prompt')
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `${BASE_URL}/v1/chat/completions`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('Authorization: Bearer lmstudio 헤더 포함', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeChatResponse('ok'))
    const provider = new LmStudioProvider({ baseUrl: BASE_URL, model: MODEL })
    await provider.complete('prompt')
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer lmstudio' }),
      }),
    )
  })

  it('HTTP 오류 → LLM_HTTP_ERROR', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Internal Error', { status: 500 }))
    const provider = new LmStudioProvider({ baseUrl: BASE_URL, model: MODEL })
    await expect(provider.complete('prompt')).rejects.toMatchObject({
      code: 'LLM_HTTP_ERROR',
    })
  })

  it('fetch 실패 → LLM_NETWORK_ERROR', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('connection refused'))
    const provider = new LmStudioProvider({ baseUrl: BASE_URL, model: MODEL })
    await expect(provider.complete('prompt')).rejects.toMatchObject({
      code: 'LLM_NETWORK_ERROR',
    })
  })

  it('빈 content → LLM_EMPTY_RESPONSE', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeChatResponse(''))
    const provider = new LmStudioProvider({ baseUrl: BASE_URL, model: MODEL })
    await expect(provider.complete('prompt')).rejects.toMatchObject({
      code: 'LLM_EMPTY_RESPONSE',
    })
  })

  it('choices 없음 → LLM_EMPTY_RESPONSE', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse({ choices: [] }))
    const provider = new LmStudioProvider({ baseUrl: BASE_URL, model: MODEL })
    await expect(provider.complete('prompt')).rejects.toMatchObject({
      code: 'LLM_EMPTY_RESPONSE',
    })
  })

  it('JSON 파싱 실패 → LLM_PARSE_ERROR', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json', { status: 200 }))
    const provider = new LmStudioProvider({ baseUrl: BASE_URL, model: MODEL })
    await expect(provider.complete('prompt')).rejects.toMatchObject({
      code: 'LLM_PARSE_ERROR',
    })
  })

  it('AbortError → LLM_TIMEOUT', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    const provider = new LmStudioProvider({ baseUrl: BASE_URL, model: MODEL, timeoutMs: 100 })
    await expect(provider.complete('prompt')).rejects.toMatchObject({
      code: 'LLM_TIMEOUT',
    })
  })

  it('LlmAdapterError 인스턴스 확인', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network'))
    const provider = new LmStudioProvider({ baseUrl: BASE_URL, model: MODEL })
    const error = await provider.complete('prompt').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(LlmAdapterError)
  })
})

describe('checkLmStudioHealth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('200 응답 → true', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    expect(await checkLmStudioHealth(BASE_URL)).toBe(true)
  })

  it('500 응답 → false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('error', { status: 500 }))
    expect(await checkLmStudioHealth(BASE_URL)).toBe(false)
  })

  it('fetch 실패 → false', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('connection refused'))
    expect(await checkLmStudioHealth(BASE_URL)).toBe(false)
  })

  it('AbortError(타임아웃) → false', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    expect(await checkLmStudioHealth(BASE_URL)).toBe(false)
  })

  it('/v1/models 엔드포인트로 요청', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    await checkLmStudioHealth(BASE_URL)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `${BASE_URL}/v1/models`,
      expect.objectContaining({ signal: expect.anything() }),
    )
  })
})
