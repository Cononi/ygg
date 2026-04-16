import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runNext } from '../../../src/commands/next.js'

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
          dimensions: {
            motivation: {
              displayName: '왜 필요한가',
              description: '왜 필요한가',
              initialScore: 0.8,
              finalScore: 0.95,
              delta: 0.15,
              rationale: '질문 보강',
              notes: 'notes',
              questionTrail: [
                {
                  round: 1,
                  evaluatorType: 'base',
                  question: '왜 필요한가?',
                  answer: '처음 작성자가 남긴 질문',
                  scoreBefore: 0.8,
                  scoreAfter: 0.95,
                  delta: 0.15,
                },
              ],
            },
          },
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
  it('creates next documents and merges next-stage ygg-point snapshot without asking new questions', async () => {
    await runNext(projectRoot, {
      now: () => new Date('2026-04-16T00:00:00.000Z'),
      selectOption: async (_prompt, options) => options.find((option) => option.value === 'stop')?.value ?? null,
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
          questionsAnswered?: number
          dimensions?: Record<string, { questionTrail?: Array<unknown> }>
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
    expect(yggPoint.stages?.next?.questionsAnswered).toBe(0)
    expect(Object.values(yggPoint.stages?.next?.dimensions ?? {}).every((dimension) => (dimension.questionTrail ?? []).length === 0)).toBe(true)
    expect(index).toContain('| [sample-topic](./sample-topic/) | 🔄 진행중 | next |')
  })

  it('can auto-chain into ygg-add when requested', async () => {
    const runAddSpy = vi.fn(async () => {})

    await runNext(projectRoot, {
      now: () => new Date('2026-04-16T00:00:00.000Z'),
      selectOption: async (_prompt, options) => options.find((option) => option.value === 'add')?.value ?? null,
      runAdd: runAddSpy,
    })

    expect(runAddSpy).toHaveBeenCalledOnce()
  })
})
