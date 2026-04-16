import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runQa } from '../../../src/commands/qa.js'

let projectRoot: string

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'ygg-qa-test-'))
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

  await mkdir(join(projectRoot, 'ygg', 'change', 'sample-topic', 'specs', 'spec-core'), { recursive: true })
  await writeFile(
    join(projectRoot, 'package.json'),
    JSON.stringify({
      name: 'qa-test',
      scripts: {
        build: 'echo build',
        lint: 'echo lint',
        typecheck: 'echo typecheck',
        test: 'echo test',
      },
    }, null, 2),
    'utf-8',
  )
  await writeFile(
    join(projectRoot, 'ygg', 'change', 'INDEX.md'),
    [
      '# Change Index',
      '',
      '| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |',
      '|---|---|---|---|---|---|',
      '| [sample-topic](./sample-topic/) | 🔄 진행중 | add | 0.95 | qa stage test topic | 2026-04-16 |',
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
      '- [x] another done task',
      '',
    ].join('\n'),
    'utf-8',
  )
  await writeFile(
    join(projectRoot, 'ygg', 'change', 'sample-topic', 'ygg-point.json'),
    JSON.stringify({ archiveType: 'feat' }, null, 2),
    'utf-8',
  )
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(projectRoot, { recursive: true, force: true })
})

describe('runQa', () => {
  it('writes a QA report and archives the topic when verification passes', async () => {
    await runQa(projectRoot, {
      now: () => new Date('2026-04-16T00:00:00.000Z'),
      runCommand: async () => ({
        success: true,
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
      }),
    })

    const qaReport = await readFile(join(projectRoot, 'ygg', 'change', 'archive', 'sample-topic', 'qa-2026-04-16.md'), 'utf-8')
    const index = await readFile(join(projectRoot, 'ygg', 'change', 'INDEX.md'), 'utf-8')

    expect(qaReport).toContain('# QA Report: sample-topic')
    expect(index).toContain('| [sample-topic](./archive/sample-topic/) | qa stage test topic | feat | v0.1.0 | latest |')
  })

  it('fails when open tasks remain', async () => {
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

    await expect(runQa(projectRoot, {
      now: () => new Date('2026-04-16T00:00:00.000Z'),
      runCommand: async () => ({
        success: true,
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
      }),
    })).rejects.toThrow(/QA failed/)
  })
})
