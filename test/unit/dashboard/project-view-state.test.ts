import { describe, expect, it } from 'vitest'

import {
  buildChangesSnapshotView,
  DEFAULT_CHANGE_STATUS,
  buildChangeSummary,
  createLatestRequestGuard,
  createChangesResetState,
  createProjectDetailResetState,
  resolveProjectDetailChangeStatus,
} from '../../../packages/dashboard/src/utils/projectViewState.js'

describe('project view state helpers', () => {
  it('builds change summary from active and archive topic counts', () => {
    expect(buildChangeSummary({
      topics: [
        { topic: 'one', status: '🔄', stage: 'add', yggPoint: '0.970', description: 'first' },
        { topic: 'two', status: '🔄', stage: 'qa', yggPoint: '1.000', description: 'second' },
      ],
      archiveTopics: [
        { topic: 'three', status: '✅', stage: '—', yggPoint: '1.000', description: 'done' },
      ],
    })).toEqual({
      inProgress: 2,
      done: 1,
      total: 3,
    })
  })

  it('builds a consistent changes snapshot view for active and completed rows', () => {
    expect(buildChangesSnapshotView({
      topics: [
        { topic: 'one', status: '🔄', stage: 'add', yggPoint: '0.970', description: 'first' },
      ],
      archiveTopics: [
        { topic: 'three', description: 'done', version: '0.0.3', latest: 'latest', date: '2026-04-16', stage: '—', yggPoint: '1.000' },
      ],
    })).toMatchObject({
      activeCount: 1,
      completedCount: 1,
      totalCount: 2,
      isCompletelyEmpty: false,
      activeEmpty: false,
      archiveEmpty: false,
      latestArchiveVersion: 'v0.0.3',
    })
  })

  it('marks active and completed empty states from the same snapshot', () => {
    expect(buildChangesSnapshotView({
      topics: [],
      archiveTopics: [
        { topic: 'three', description: 'done', version: 'v0.0.3', latest: 'latest', date: '2026-04-16', stage: '—', yggPoint: '1.000' },
      ],
    })).toMatchObject({
      activeCount: 0,
      completedCount: 1,
      isCompletelyEmpty: false,
      activeEmpty: true,
      archiveEmpty: false,
    })
  })

  it('creates a default project detail reset state', () => {
    expect(createProjectDetailResetState()).toEqual({
      tab: 'skills',
      target: '',
      changeStatus: DEFAULT_CHANGE_STATUS,
    })
  })

  it('creates changes reset state with the provided initial sub tab', () => {
    expect(createChangesResetState()).toEqual({
      subTab: 'active',
      editingStage: null,
    })
    expect(createChangesResetState('archive')).toEqual({
      subTab: 'archive',
      editingStage: null,
    })
  })

  it('keeps only the latest request as current', () => {
    const guard = createLatestRequestGuard()

    const first = guard.begin()
    expect(guard.isCurrent(first)).toBe(true)

    const second = guard.begin()
    expect(guard.isCurrent(first)).toBe(false)
    expect(guard.isCurrent(second)).toBe(true)
  })

  it('prefers live changes summary when it has actual counts', () => {
    expect(resolveProjectDetailChangeStatus(
      { inProgress: 2, done: 1, total: 3 },
      { inProgress: 0, done: 0, total: 0 },
    )).toEqual({
      inProgress: 2,
      done: 1,
      total: 3,
    })
  })

  it('falls back to project detail summary when live changes summary is empty', () => {
    expect(resolveProjectDetailChangeStatus(
      { inProgress: 0, done: 0, total: 0 },
      { inProgress: 2, done: 1, total: 3 },
    )).toEqual({
      inProgress: 2,
      done: 1,
      total: 3,
    })
  })

  it('uses fallback summary when live changes response is unavailable', () => {
    expect(resolveProjectDetailChangeStatus(
      null,
      { inProgress: 1, done: 2, total: 3 },
    )).toEqual({
      inProgress: 1,
      done: 2,
      total: 3,
    })
  })
})
