import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runAdd } from '../../../src/commands/add.js'

let projectRoot: string

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'ygg-add-test-'))
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

  await mkdir(join(projectRoot, 'ygg', 'change', 'sample-topic', 'specs', 'spec-core'), { recursive: true })
  await writeFile(
    join(projectRoot, 'ygg', 'change', 'INDEX.md'),
    [
      '# Change Index',
      '',
      '| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |',
      '|---|---|---|---|---|---|',
      '| [sample-topic](./sample-topic/) | 🔄 진행중 | next | 0.95 | add stage test topic | 2026-04-16 |',
      '',
      '### Archive',
      '| 토픽 | 설명 | 유형 | 버전 | 최신 | 날짜 |',
      '|---|---|---|---|---|---|',
      '',
    ].join('\n'),
    'utf-8',
  )
  await writeFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'design.md'), '# Design\n', 'utf-8')
  await writeFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'specs', 'spec-core', 'spec.md'), '# Spec\n', 'utf-8')
  await writeFile(
    join(projectRoot, 'ygg', 'change', 'sample-topic', 'tasks.md'),
    [
      '# Tasks',
      '',
      '- [x] done task',
      '- [ ] open task',
      '',
    ].join('\n'),
    'utf-8',
  )
  await writeFile(
    join(projectRoot, 'package.json'),
    JSON.stringify({
      name: 'add-test',
      scripts: {
        build: 'echo build',
        lint: 'echo lint',
        typecheck: 'echo typecheck',
        test: 'echo test',
      },
    }, null, 2),
    'utf-8',
  )
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(projectRoot, { recursive: true, force: true })
})

describe('runAdd', () => {
  it('promotes the topic to add stage and writes a daily log', async () => {
    await runAdd(projectRoot, {
      now: () => new Date('2026-04-16T00:00:00.000Z'),
      selectOption: async (prompt, options) => {
        if (prompt.includes('구현 방식을 선택')) {
          return options.find((option) => option.value === 'stop')?.value ?? null
        }
        return options.find((option) => option.value === 'stop')?.value ?? null
      },
    })

    const index = await readFile(join(projectRoot, 'ygg', 'change', 'INDEX.md'), 'utf-8')
    const dailyLog = await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', '2026-04-16.md'), 'utf-8')

    expect(index).toContain('| [sample-topic](./sample-topic/) | 🔄 진행중 | add |')
    expect(dailyLog).toContain('# Change Log: sample-topic')
    expect(dailyLog).toContain('현재 task checklist: 1/2 완료')
    expect(dailyLog).toContain('General: open task')
  })

  it('can auto-chain into ygg-qa when requested', async () => {
    await writeFile(
      join(projectRoot, 'ygg', 'change', 'sample-topic', 'tasks.md'),
      [
        '# Tasks',
        '',
        '- [x] done task',
        '- [x] another done task',
        '',
      ].join('\n'),
      'utf-8',
    )

    const runQaSpy = vi.fn(async () => {})

    await runAdd(projectRoot, {
      now: () => new Date('2026-04-16T00:00:00.000Z'),
      selectOption: async (_prompt, options) => options.find((option) => option.value === 'qa')?.value ?? null,
      runQa: runQaSpy,
    })

    expect(runQaSpy).toHaveBeenCalledOnce()
  })

  it('auto-completes generated next-stage document tasks from existing artifacts', async () => {
    await writeFile(
      join(projectRoot, 'ygg', 'change', 'sample-topic', 'tasks.md'),
      [
        '# Tasks',
        '',
        '1. create에서 확정된 요청과 범위를 기준으로 설계 문서를 정리한다.',
        '- [ ] Why/What Changes/Impact를 반영해 design.md를 생성한다.',
        '',
        '2. 구현 계약을 문서화한다.',
        '- [ ] specs/spec-core/spec.md를 생성한다.',
        '- [ ] add 단계가 바로 구현할 수 있게 tasks.md를 정리한다.',
        '',
        '3. ygg-point와 index를 갱신한다.',
        '- [ ] next stage snapshot을 저장한다.',
        '- [ ] INDEX.md stage를 next로 바꾼다.',
        '',
        '4. verification',
        '- [ ] 관련 unit test와 build/typecheck를 실행한다.',
        '',
      ].join('\n'),
      'utf-8',
    )
    await writeFile(
      join(projectRoot, 'ygg', 'change', 'sample-topic', 'ygg-point.json'),
      JSON.stringify({
        currentStage: 'next',
        stages: { next: { dimensions: {} } },
      }, null, 2),
      'utf-8',
    )

    await runAdd(projectRoot, {
      now: () => new Date('2026-04-16T00:00:00.000Z'),
      selectOption: async (prompt, options) => {
        if (prompt.includes('구현 방식을 선택')) {
          return options.find((option) => option.value === 'implement-auto')?.value ?? null
        }
        return options.find((option) => option.value === 'stop')?.value ?? null
      },
      runCommand: async () => ({
        success: true,
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
      }),
    })

    const tasks = await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'tasks.md'), 'utf-8')
    expect(tasks).toContain('- [x] Why/What Changes/Impact를 반영해 design.md를 생성한다.')
    expect(tasks).toContain('- [x] specs/spec-core/spec.md를 생성한다.')
    expect(tasks).toContain('- [x] add 단계가 바로 구현할 수 있게 tasks.md를 정리한다.')
    expect(tasks).toContain('- [x] next stage snapshot을 저장한다.')
    expect(tasks).toContain('- [x] INDEX.md stage를 next로 바꾼다.')
    expect(tasks).toContain('- [x] 관련 unit test와 build/typecheck를 실행한다.')
  })

  it('supports a task implementation hook for repository-specific work', async () => {
    const implementTask = vi.fn(async (task) => {
      if (task.text === 'open task') {
        return { completed: true, note: 'implemented via injected task runner' }
      }
      return null
    })

    await runAdd(projectRoot, {
      now: () => new Date('2026-04-16T00:00:00.000Z'),
      selectOption: async (prompt, options) => {
        if (prompt.includes('구현 방식을 선택')) {
          return options.find((option) => option.value === 'implement-all')?.value ?? null
        }
        return options.find((option) => option.value === 'stop')?.value ?? null
      },
      implementTask,
    })

    const tasks = await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'tasks.md'), 'utf-8')
    expect(tasks).toContain('- [x] open task')
    expect(implementTask).toHaveBeenCalled()
  })

  it('executes verification commands for matching task text and marks the task complete', async () => {
    await writeFile(
      join(projectRoot, 'ygg', 'change', 'sample-topic', 'tasks.md'),
      [
        '# Tasks',
        '',
        '1. verification',
        '- [ ] 관련 unit test와 build/typecheck를 실행한다.',
        '',
      ].join('\n'),
      'utf-8',
    )

    const runCommand = vi.fn(async () => ({
      success: true,
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
    }))

    await runAdd(projectRoot, {
      now: () => new Date('2026-04-16T00:00:00.000Z'),
      selectOption: async (prompt, options) => {
        if (prompt.includes('구현 방식을 선택')) {
          return options.find((option) => option.value === 'implement-auto')?.value ?? null
        }
        return options.find((option) => option.value === 'stop')?.value ?? null
      },
      runCommand,
    })

    const tasks = await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', 'tasks.md'), 'utf-8')
    const dailyLog = await readFile(join(projectRoot, 'ygg', 'change', 'sample-topic', '2026-04-16.md'), 'utf-8')

    expect(tasks).toContain('- [x] 관련 unit test와 build/typecheck를 실행한다.')
    expect(runCommand).toHaveBeenCalledTimes(3)
    expect(dailyLog).toContain('Build: PASS, Typecheck: PASS, Test: PASS')
  })
})
