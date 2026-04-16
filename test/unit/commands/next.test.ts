import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runNext } from '../../../src/commands/next.js'
import { writeConfigYggPointAutoMode } from '../../../src/i18n/config.js'

let projectRoot: string

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'ygg-next-test-'))
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

  await mkdir(join(projectRoot, 'ygg', 'change', 'sample-topic'), { recursive: true })
  await writeFile(
    join(projectRoot, 'ygg', 'change', 'INDEX.md'),
    [
      '# Change Index',
      '',
      '| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |',
      '|---|---|---|---|---|---|',
      '| [sample-topic](./sample-topic/) | 🔄 진행중 | create | 0.95 | 처음 작성자가 남긴 질문 | 2026-04-16 |',
      '',
      '### Archive',
      '| 토픽 | 설명 | 유형 | 버전 | 최신 | 날짜 |',
      '|---|---|---|---|---|---|',
      '',
    ].join('\n'),
    'utf-8',
  )
  await writeFile(
    join(projectRoot, 'ygg', 'change', 'sample-topic', 'proposal.md'),
    [
      '# Proposal',
      '',
      '## Why',
      '- YGG Point next 단계가 실제로 동작해야 한다.',
      '',
      '## What Changes',
      '- design/spec/tasks와 next ygg-point를 생성한다.',
      '',
    ].join('\n'),
    'utf-8',
  )
  await writeFile(
    join(projectRoot, 'ygg', 'change', 'sample-topic', 'ygg-point.json'),
    JSON.stringify({
      schemaVersion: '2.0',
      topic: 'sample-topic',
      date: '2026-04-16',
      requestText: '처음 작성자가 남긴 질문',
      archiveType: 'feat',
      currentStage: 'create',
      threshold: 0.95,
      score: 0.95,
      ready: true,
      stages: {
        create: {
          ready: true,
          initialScore: 0.8,
          finalScore: 0.95,
          delta: 0.15,
          rounds: 2,
          questionsAnswered: 1,
          improvementSummary: 'create done',
          dimensions: {},
        },
      },
    }, null, 2),
    'utf-8',
  )
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(projectRoot, { recursive: true, force: true })
})

describe('runNext', () => {
  it('creates next documents and merges next-stage ygg-point snapshot', async () => {
    await writeConfigYggPointAutoMode(projectRoot, 'on')

    let answerCount = 0

    await runNext(projectRoot, {
      askQuestion: async (question) => {
        answerCount += 1
        return `next-answer-${answerCount}: ${question}`
      },
      selectOption: async (_prompt, options) => options[0]?.value ?? null,
      now: () => new Date('2026-04-16T00:00:00.000Z'),
    })

    const design = await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'design.md'), 'utf-8')
    const spec = await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'specs', 'spec-core', 'spec.md'), 'utf-8')
    const tasks = await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'tasks.md'), 'utf-8')
    const yggPoint = JSON.parse(await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'ygg-point.json'), 'utf-8')) as {
      requestText?: string
      currentStage?: string
      stages?: {
        create?: object
        next?: {
          dimensions?: Record<string, { questionTrail?: Array<{ round?: number; answerSource?: string }> }>
        }
      }
    }
    const index = await readFile(join(projectRoot, 'ygg', 'change', 'INDEX.md'), 'utf-8')

    expect(design).toContain('# Design: sample-topic')
    expect(spec).toContain('## Requirements')
    expect(tasks).toContain('# Tasks')
    expect(yggPoint.requestText).toBe('처음 작성자가 남긴 질문')
    expect(yggPoint.currentStage).toBe('next')
    expect(yggPoint.stages?.create).toBeDefined()
    expect(yggPoint.stages?.next).toBeDefined()

    const trails = Object.values(yggPoint.stages?.next?.dimensions ?? {})
      .flatMap((dimension) => dimension.questionTrail ?? [])
    expect(trails.some((entry) => entry.answerSource === 'auto')).toBe(true)
    expect(trails.every((entry) => typeof entry.round === 'number' && entry.round >= 1)).toBe(true)
    expect(index).toContain('| [sample-topic](./sample-topic/) | 🔄 진행중 | next |')
  })

  it('does not auto-answer next-stage questions when auto mode is off', async () => {
    await writeConfigYggPointAutoMode(projectRoot, 'off')

    let answerCount = 0
    await runNext(projectRoot, {
      askQuestion: async (question) => {
        answerCount += 1
        return `next-answer-${answerCount}: ${question}`
      },
      selectOption: async (_prompt, options) => options[0]?.value ?? null,
      now: () => new Date('2026-04-16T00:00:00.000Z'),
    })

    const yggPoint = JSON.parse(await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'ygg-point.json'), 'utf-8')) as {
      stages?: {
        next?: {
          dimensions?: Record<string, { questionTrail?: Array<{ answerSource?: string }> }>
        }
      }
    }

    const trails = Object.values(yggPoint.stages?.next?.dimensions ?? {})
      .flatMap((dimension) => dimension.questionTrail ?? [])

    expect(trails.some((entry) => entry.answerSource === 'auto')).toBe(false)
  })

  it('requires at least five user-answered questions per dimension when auto mode is off', async () => {
    await writeConfigYggPointAutoMode(projectRoot, 'off')

    let answerCount = 0
    await runNext(projectRoot, {
      askQuestion: async (question) => {
        answerCount += 1
        return `next-manual-answer-${answerCount}: ${question}`
      },
      selectOption: async (_prompt, options) => options[0]?.value ?? null,
      now: () => new Date('2026-04-16T00:00:00.000Z'),
    })

    const yggPoint = JSON.parse(await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'ygg-point.json'), 'utf-8')) as {
      stages?: {
        next?: {
          dimensions?: Record<string, { questionTrail?: Array<{ answerSource?: string }> }>
        }
      }
    }

    const dimensions = yggPoint.stages?.next?.dimensions ?? {}
    expect(Object.keys(dimensions)).toHaveLength(5)
    for (const dimension of Object.values(dimensions)) {
      const manualTrail = (dimension.questionTrail ?? []).filter((entry) => entry.answerSource !== 'auto')
      expect(manualTrail.length).toBeGreaterThanOrEqual(5)
    }
  })
})
