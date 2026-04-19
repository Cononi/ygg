import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ParsedChangeIndex } from '../../../src/core/change-index.js'
import {
  buildProjectDashboardSummary,
  buildProjectFlowSnapshot,
} from '../../../src/server/project-dashboard.js'

describe('project dashboard summary helpers', () => {
  let projectRoot: string

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'ygg-dashboard-summary-'))
    await mkdir(join(projectRoot, 'ygg', 'change', 'dashboard-refresh', 'specs', 'dashboard-flow'), { recursive: true })

    await writeFile(
      join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'dashboard-project',
        dependencies: {
          react: '^18.0.0',
          '@mui/material': '^5.0.0',
        },
      }, null, 2),
      'utf-8',
    )
    await writeFile(join(projectRoot, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}', 'utf-8')
    await writeFile(join(projectRoot, 'requirements.txt'), 'pypdf==4.0.0\n', 'utf-8')
    await writeFile(join(projectRoot, 'ygg', 'change', 'dashboard-refresh', 'proposal.md'), '# Proposal\n', 'utf-8')
    await writeFile(join(projectRoot, 'ygg', 'change', 'dashboard-refresh', 'design.md'), '# Design\n', 'utf-8')
    await writeFile(join(projectRoot, 'ygg', 'change', 'dashboard-refresh', 'tasks.md'), '# Tasks\n', 'utf-8')
  })

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true })
  })

  it('builds generated summary tags and active stage details', async () => {
    const model: ParsedChangeIndex = {
      topics: [
        {
          topic: 'dashboard-refresh',
          status: '🔄 진행중',
          stage: 'add',
          yggPoint: '0.98',
          description: 'pdf 분석 dashboard를 react 기반으로 전면 개편',
          date: '2026-04-19',
        },
      ],
      archiveTopics: [],
    }

    const summary = await buildProjectDashboardSummary({
      projectPath: projectRoot,
      entry: {
        id: 'project-1',
        path: projectRoot,
        name: 'dashboard-project',
        category: 'Platform',
        createdAt: '',
        updatedAt: '',
        yggVersion: '1.0.0',
      },
      targets: [
        {
          target: 'codex',
          label: 'Codex',
          files: { skills: ['ygg-create'], agents: ['AGENTS'], commands: [] },
        },
      ],
      model,
    })

    expect(summary.tags).toEqual(expect.arrayContaining(['Node.js', 'TypeScript', 'React', 'PDF Analysis', 'Dashboard']))
    expect(summary.currentStage).toBe('add')
    expect(summary.stageReason).toEqual(expect.arrayContaining([
      'live INDEX 기준 active topic은 dashboard-refresh입니다.',
    ]))
    expect(summary.nextAction).toBe('구현을 마무리하고 QA를 준비합니다')
    expect(summary.nextActionReason).toEqual(expect.arrayContaining([
      'dashboard-refresh이 add 단계이므로 구현 마무리와 QA 준비가 다음 순서입니다.',
    ]))
    expect(summary.descriptionSource).toBe('generated')
    expect(summary.activeTopic).toBe('dashboard-refresh')
    expect(summary.activeTargets).toEqual([
      { id: 'codex', label: 'Codex' },
    ])
  })

  it('builds flow snapshot with stage and document nodes', async () => {
    const model: ParsedChangeIndex = {
      topics: [
        {
          topic: 'dashboard-refresh',
          status: '🔄 진행중',
          stage: 'add',
          yggPoint: '0.98',
          description: 'pdf 분석 dashboard를 react 기반으로 전면 개편',
          date: '2026-04-19',
        },
      ],
      archiveTopics: [],
    }

    const summary = await buildProjectDashboardSummary({
      projectPath: projectRoot,
      entry: {
        id: 'project-1',
        path: projectRoot,
        name: 'dashboard-project',
        category: 'Platform',
        createdAt: '',
        updatedAt: '',
        yggVersion: '1.0.0',
      },
      targets: [
        {
          target: 'codex',
          label: 'Codex',
          files: { skills: ['ygg-create'], agents: ['AGENTS'], commands: [] },
        },
      ],
      model,
    })

    const snapshot = await buildProjectFlowSnapshot({
      projectPath: projectRoot,
      entry: {
        id: 'project-1',
        path: projectRoot,
        name: 'dashboard-project',
        category: 'Platform',
        createdAt: '',
        updatedAt: '',
        yggVersion: '1.0.0',
      },
      model,
      targets: [
        {
          target: 'codex',
          label: 'Codex',
          files: { skills: ['ygg-create'], agents: ['AGENTS'], commands: [] },
        },
      ],
      contentSummary: { skills: 1, agents: 1, commands: 0, changes: 1 },
      summary,
    })

    expect(snapshot.legend.currentStage).toBe('add')
    expect(snapshot.legend.activeTopic).toBe('dashboard-refresh')
    expect(snapshot.legend.stageReason).toEqual(expect.arrayContaining([
      'live INDEX 기준 active topic은 dashboard-refresh입니다.',
    ]))
    expect(snapshot.nodes.find(node => node.id === 'stage:add')?.status).toBe('active')
    expect(snapshot.nodes.find(node => node.id === 'document:proposal')?.status).toBe('done')
    expect(snapshot.nodes.find(node => node.id === 'document:specs')?.status).toBe('done')
    expect(snapshot.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'stage:add', target: 'stage:qa' }),
      expect.objectContaining({ source: 'stage:add', target: 'document:tasks' }),
    ]))
  })
})
