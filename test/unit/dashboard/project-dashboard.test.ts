import { describe, expect, it } from 'vitest'

import {
  buildCategoryProjectCounts,
  flattenTargetFileItems,
} from '../../../packages/dashboard/src/utils/projectDashboard.js'

describe('project dashboard helpers', () => {
  it('flattens target-specific files into tab items', () => {
    expect(flattenTargetFileItems([
      {
        target: 'claude',
        label: 'Claude',
        files: {
          skills: ['ygg-create'],
          agents: ['expert-uiux'],
          commands: ['ygg/create'],
        },
      },
      {
        target: 'codex',
        label: 'Codex',
        files: {
          skills: ['ygg-next'],
          agents: ['AGENTS'],
          commands: [],
        },
      },
    ], 'skills')).toEqual([
      {
        id: 'claude:skills:ygg-create',
        target: 'claude',
        targetLabel: 'Claude',
        type: 'skills',
        name: 'ygg-create',
      },
      {
        id: 'codex:skills:ygg-next',
        target: 'codex',
        targetLabel: 'Codex',
        type: 'skills',
        name: 'ygg-next',
      },
    ])
  })

  it('builds project counts for each category', () => {
    expect(buildCategoryProjectCounts([
      {
        category: 'home',
        projects: [
          { id: '1', path: '/tmp/a', name: 'a', category: 'home', createdAt: '', updatedAt: '', yggVersion: '', currentVersion: '', projectVersion: '', versionStatus: 'latest', contentSummary: { skills: 0, agents: 0, commands: 0, changes: 0 }, changeStatus: { total: 0, inProgress: 0, done: 0 } },
          { id: '2', path: '/tmp/b', name: 'b', category: 'home', createdAt: '', updatedAt: '', yggVersion: '', currentVersion: '', projectVersion: '', versionStatus: 'latest', contentSummary: { skills: 0, agents: 0, commands: 0, changes: 0 }, changeStatus: { total: 0, inProgress: 0, done: 0 } },
        ],
      },
      {
        category: 'Platform',
        projects: [
          { id: '3', path: '/tmp/c', name: 'c', category: 'Platform', createdAt: '', updatedAt: '', yggVersion: '', currentVersion: '', projectVersion: '', versionStatus: 'latest', contentSummary: { skills: 0, agents: 0, commands: 0, changes: 0 }, changeStatus: { total: 0, inProgress: 0, done: 0 } },
        ],
      },
    ])).toEqual({
      home: 2,
      Platform: 1,
    })
  })
})
