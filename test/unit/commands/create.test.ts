import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runCreate } from '../../../src/commands/create.js'
import { writeConfigYggPointAutoMode } from '../../../src/i18n/config.js'

let projectRoot: string

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'ygg-create-test-'))
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(projectRoot, { recursive: true, force: true })
})

describe('runCreate', () => {
  async function findCreatedTopicDir(): Promise<string> {
    const entries = await readdir(join(projectRoot, 'ygg', 'change'), { withFileTypes: true })
    const topic = entries.find((entry) => entry.isDirectory() && entry.name !== 'archive')
    if (!topic) {
      throw new Error('No topic directory created')
    }
    return join(projectRoot, 'ygg', 'change', topic.name)
  }

  it('creates a topic, proposal, ygg-point document, and change index entry', async () => {
    let answerCount = 0

    await runCreate(projectRoot, {
      description: [
        '왜 필요한가: create 실행 경로가 없어 proposal을 직접 만들 수 없다.',
        '범위: ygg create 커맨드와 proposal/ygg-point 저장.',
        '사용자: ygg 워크플로우를 시작하는 개발자.',
        '제외: next/add/qa 단계 자동 체인은 이번 변경에서 제외.',
        '영향: src/cli.ts, src/commands/create.ts, ygg/change/INDEX.md.',
      ].join('\n'),
    }, {
      askQuestion: async () => {
        answerCount += 1
        return `user-answer-${answerCount}`
      },
      selectOption: async (_prompt, options) => options.find((option) => option.value === 'stop')?.value ?? null,
      now: () => new Date('2026-04-16T00:00:00.000Z'),
    })

    const topicDir = await findCreatedTopicDir()
    const proposal = await readFile(join(topicDir, 'proposal.md'), 'utf-8')
    const yggPoint = JSON.parse(await readFile(join(topicDir, 'ygg-point.json'), 'utf-8')) as {
      requestText?: string
      score: number
      ready: boolean
      stages?: {
        create?: {
          questionsAnswered: number
          dimensions?: Record<string, { questionTrail?: Array<{ round?: number }> }>
        }
      }
    }
    const indexContent = await readFile(join(projectRoot, 'ygg', 'change', 'INDEX.md'), 'utf-8')

    expect(proposal).toContain('## Why')
    expect(proposal).toContain('## Boundary')
    expect(yggPoint.requestText).toContain('왜 필요한가: create 실행 경로가 없어 proposal을 직접 만들 수 없다.')
    expect(yggPoint.ready).toBe(true)
    expect(yggPoint.score).toBeGreaterThanOrEqual(0.95)
    expect(yggPoint.stages?.create?.questionsAnswered).toBeGreaterThan(0)

    const rounds = Object.values(yggPoint.stages?.create?.dimensions ?? {})
      .flatMap((dimension) => dimension.questionTrail ?? [])
      .map((entry) => entry.round ?? 0)
    expect([...rounds].sort((a, b) => a - b)).toEqual(
      Array.from({ length: rounds.length }, (_, index) => index + 1),
    )
    expect(indexContent).toContain('| 🔄 진행중 | create |')
  })

  it('records auto answers in ygg-point when auto mode is on', async () => {
    await writeConfigYggPointAutoMode(projectRoot, 'on')

    await runCreate(projectRoot, {
      description: [
        '왜 필요한가: create 단계에서 auto mode가 실제로 작동해야 한다.',
        '범위: auto-verifiable evaluator를 내부 처리하고 나머지는 질문한다.',
        '사용자: ygg workflow maintainer.',
        '제외: qa/archive 로직 변경 없음.',
        '영향: ygg point scoring과 topic 문서 생성.',
      ].join('\n'),
    }, {
      askQuestion: async () => 'interactive-answer',
      selectOption: async (_prompt, options) => options.find((option) => option.value === 'stop')?.value ?? null,
      now: () => new Date('2026-04-16T00:00:00.000Z'),
    })

    const topicDir = await findCreatedTopicDir()
    const yggPoint = JSON.parse(await readFile(join(topicDir, 'ygg-point.json'), 'utf-8')) as {
      stages?: {
        create?: {
          dimensions?: Record<string, { questionTrail?: Array<{ answer?: string; answerSource?: string }> }>
        }
      }
    }

    const trails = Object.values(yggPoint.stages?.create?.dimensions ?? {})
      .flatMap((dimension) => dimension.questionTrail ?? [])

    expect(trails.some((entry) => entry.answerSource === 'auto')).toBe(true)
    expect(trails.some((entry) => (entry.answer ?? '').includes('Auto-verified from'))).toBe(true)
  })

  it('does not enforce five manual answers per dimension when auto mode is off', async () => {
    await writeConfigYggPointAutoMode(projectRoot, 'off')

    await runCreate(projectRoot, {
      description: [
        '왜 필요한가: create 질문을 한 번에 하나씩 진행해야 한다.',
        '범위: create 질문 루프와 proposal 생성 품질.',
        '사용자: ygg workflow maintainer.',
        '제외: next/add/qa 변경 없음.',
        '영향: src/commands/create.ts, src/core/ygg-point.ts.',
      ].join('\n'),
    }, {
      askQuestion: async () => 'manual-answer',
      selectOption: async (_prompt, options) => options.find((option) => option.value === 'stop')?.value ?? null,
      now: () => new Date('2026-04-16T00:00:00.000Z'),
    })

    const topicDir = await findCreatedTopicDir()
    const yggPoint = JSON.parse(await readFile(join(topicDir, 'ygg-point.json'), 'utf-8')) as {
      stages?: {
        create?: {
          dimensions?: Record<string, { questionTrail?: Array<{ answerSource?: string }> }>
        }
      }
    }

    const manualTrailCounts = Object.values(yggPoint.stages?.create?.dimensions ?? {})
      .map((dimension) => (dimension.questionTrail ?? []).filter((entry) => entry.answerSource !== 'auto').length)

    expect(manualTrailCounts.reduce((sum, count) => sum + count, 0)).toBeLessThan(25)
  })

  it('can auto-chain into ygg-next when requested', async () => {
    const runNextSpy = vi.fn(async () => {})

    await runCreate(projectRoot, {
      description: [
        '왜 필요한가: create 이후 next 자동 연결이 필요하다.',
        '범위: create 완료 후 next 호출.',
        '사용자: ygg workflow maintainer.',
      ].join('\n'),
    }, {
      askQuestion: async () => 'answer',
      selectOption: async (prompt, options) => {
        if (prompt.includes('auto-mode')) return options[0]?.value ?? null
        return options.find((option) => option.value === 'next')?.value ?? null
      },
      runNext: runNextSpy,
      now: () => new Date('2026-04-16T00:00:00.000Z'),
    })

    expect(runNextSpy).toHaveBeenCalledOnce()
  })
})
