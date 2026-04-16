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
      askQuestion: async (question) => {
        answerCount += 1
        return `user-answer-${answerCount}: ${question}`
      },
      selectOption: async (_prompt, options) => options[0]?.value ?? null,
      now: () => new Date('2026-04-16T00:00:00.000Z'),
    })

    const topicDir = await findCreatedTopicDir()
    const proposal = await readFile(join(topicDir, 'proposal.md'), 'utf-8')
    const yggPoint = JSON.parse(await readFile(join(topicDir, 'ygg-point.json'), 'utf-8')) as {
      requestText?: string
      score: number
      ready: boolean
      stages?: { create?: { questionsAnswered: number } }
    }
    const indexContent = await readFile(join(projectRoot, 'ygg', 'change', 'INDEX.md'), 'utf-8')

    expect(proposal).toContain('## Why')
    expect(proposal).toContain('## Boundary')
    expect(yggPoint.requestText).toContain('왜 필요한가: create 실행 경로가 없어 proposal을 직접 만들 수 없다.')
    expect(yggPoint.ready).toBe(true)
    expect(yggPoint.score).toBeGreaterThanOrEqual(0.95)
    expect(yggPoint.stages.create?.questionsAnswered).toBeGreaterThan(0)
    expect(indexContent).toContain('| 🔄 진행중 | create |')
  })

  it('records auto answers in ygg-point when auto mode is on', async () => {
    await writeConfigYggPointAutoMode(projectRoot, 'on')

    let answerCount = 0
    await runCreate(projectRoot, {
      description: [
        '왜 필요한가: create 단계에서 auto mode가 실제로 작동해야 한다.',
        '범위: auto-verifiable evaluator를 내부 처리하고 나머지는 질문한다.',
        '사용자: ygg workflow maintainer.',
        '제외: qa/archive 로직 변경 없음.',
        '영향: ygg point scoring과 topic 문서 생성.',
      ].join('\n'),
    }, {
      askQuestion: async (question) => {
        answerCount += 1
        return `interactive-answer-${answerCount}: ${question}`
      },
      selectOption: async (_prompt, options) => options[0]?.value ?? null,
      now: () => new Date('2026-04-16T00:00:00.000Z'),
    })

    const topicDir = await findCreatedTopicDir()
    const yggPoint = JSON.parse(await readFile(join(topicDir, 'ygg-point.json'), 'utf-8')) as {
      stages?: {
        create?: {
          dimensions?: Record<string, { questionTrail?: Array<{ answer?: string }> }>
        }
      }
    }

    const trails = Object.values(yggPoint.stages?.create?.dimensions ?? {})
      .flatMap((dimension) => dimension.questionTrail ?? [])
      .map((entry) => entry.answer ?? '')

    expect(trails.some((answer) => answer.includes('Auto-verified from'))).toBe(true)
  })

  it('requires at least five user-answered questions per dimension when auto mode is off', async () => {
    await writeConfigYggPointAutoMode(projectRoot, 'off')

    let answerCount = 0
    await runCreate(projectRoot, {
      description: '짧은 요청',
    }, {
      askQuestion: async (question) => {
        answerCount += 1
        return `manual-answer-${answerCount}: ${question}`
      },
      selectOption: async (_prompt, options) => options[0]?.value ?? null,
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

    const dimensions = yggPoint.stages?.create?.dimensions ?? {}
    expect(Object.keys(dimensions)).toHaveLength(5)
    for (const dimension of Object.values(dimensions)) {
      const manualTrail = (dimension.questionTrail ?? []).filter((entry) => entry.answerSource !== 'auto')
      expect(manualTrail.length).toBeGreaterThanOrEqual(5)
    }
  })
})
