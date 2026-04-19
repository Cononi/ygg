import { describe, expect, it } from 'vitest'

import {
  PROJECT_CARD_ACTION_ORDER,
  buildCategoryProjectCounts,
  filterTargetFileItems,
  formatDescriptionSourceLabel,
  formatProjectStageLabel,
  flattenTargetFileItems,
  getProjectStageTone,
  hasMultipleTargets,
  summarizeAppliedInits,
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
          {
            id: '1',
            path: '/tmp/a',
            name: 'a',
            category: 'home',
            createdAt: '',
            updatedAt: '',
            yggVersion: '',
            currentVersion: '',
            projectVersion: '',
            versionStatus: 'latest',
            contentSummary: { skills: 0, agents: 0, commands: 0, changes: 0 },
            summary: {
              tags: [],
              description: '',
              descriptionSource: 'generated',
              currentStage: 'setup',
              stageReason: [],
              nextAction: '첫 change를 생성합니다',
              nextActionReason: [],
              activeTargets: [],
            },
            changeStatus: { total: 0, inProgress: 0, done: 0 },
          },
          {
            id: '2',
            path: '/tmp/b',
            name: 'b',
            category: 'home',
            createdAt: '',
            updatedAt: '',
            yggVersion: '',
            currentVersion: '',
            projectVersion: '',
            versionStatus: 'latest',
            contentSummary: { skills: 0, agents: 0, commands: 0, changes: 0 },
            summary: {
              tags: [],
              description: '',
              descriptionSource: 'generated',
              currentStage: 'setup',
              stageReason: [],
              nextAction: '첫 change를 생성합니다',
              nextActionReason: [],
              activeTargets: [],
            },
            changeStatus: { total: 0, inProgress: 0, done: 0 },
          },
        ],
      },
      {
        category: 'Platform',
        projects: [
          {
            id: '3',
            path: '/tmp/c',
            name: 'c',
            category: 'Platform',
            createdAt: '',
            updatedAt: '',
            yggVersion: '',
            currentVersion: '',
            projectVersion: '',
            versionStatus: 'latest',
            contentSummary: { skills: 0, agents: 0, commands: 0, changes: 0 },
            summary: {
              tags: ['React'],
              description: '',
              descriptionSource: 'generated',
              currentStage: 'add',
              stageReason: [],
              nextAction: '구현을 마무리하고 QA를 준비합니다',
              nextActionReason: [],
              activeTargets: [],
            },
            changeStatus: { total: 0, inProgress: 0, done: 0 },
          },
        ],
      },
    ])).toEqual({
      home: 2,
      Platform: 1,
    })
  })

  it('keeps project card actions limited to move and delete in order', () => {
    expect(PROJECT_CARD_ACTION_ORDER).toEqual(['move', 'delete'])
  })

  it('summarizes applied init chips with overflow count', () => {
    expect(summarizeAppliedInits([
      { id: 'claude', label: 'Claude' },
      { id: 'codex', label: 'Codex' },
      { id: 'gemini', label: 'Gemini' },
      { id: 'cursor', label: 'Cursor' },
    ])).toEqual({
      visible: [
        { id: 'claude', label: 'Claude' },
        { id: 'codex', label: 'Codex' },
        { id: 'gemini', label: 'Gemini' },
      ],
      overflow: 1,
    })
  })

  it('filters flattened target files by target id', () => {
    const items = flattenTargetFileItems([
      {
        target: 'claude',
        label: 'Claude',
        files: { skills: ['ygg-create'], agents: [], commands: [] },
      },
      {
        target: 'codex',
        label: 'Codex',
        files: { skills: ['ygg-next'], agents: [], commands: [] },
      },
    ], 'skills')

    expect(filterTargetFileItems(items, 'codex')).toEqual([
      {
        id: 'codex:skills:ygg-next',
        target: 'codex',
        targetLabel: 'Codex',
        type: 'skills',
        name: 'ygg-next',
      },
    ])
    expect(hasMultipleTargets([
      { target: 'claude', label: 'Claude', files: { skills: [], agents: [], commands: [] } },
      { target: 'codex', label: 'Codex', files: { skills: [], agents: [], commands: [] } },
    ])).toBe(true)
  })

  it('formats stage and description labels for dashboard chips', () => {
    expect(formatProjectStageLabel('complete')).toBe('complete')
    expect(formatProjectStageLabel('add')).toBe('add')
    expect(getProjectStageTone('complete')).toBe('success')
    expect(getProjectStageTone('setup')).toBe('default')
    expect(getProjectStageTone('next')).toBe('warning')
    expect(formatDescriptionSourceLabel('manual')).toBe('manual')
    expect(formatDescriptionSourceLabel('generated')).toBe('generated')
  })
})
