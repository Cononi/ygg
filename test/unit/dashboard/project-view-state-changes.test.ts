import { describe, expect, it } from 'vitest'

import { buildChangesSnapshotView } from '../../../packages/dashboard/src/utils/projectViewState.js'

describe('changes snapshot view', () => {
  it('builds active and archive rows with latest archive version metadata', () => {
    const snapshot = buildChangesSnapshotView({
      topics: [
        {
          topic: 'active-topic',
          status: '🔄 진행중',
          stage: 'add',
          yggPoint: '0.98',
          description: 'active description',
          date: '2026-04-17',
        },
      ],
      archiveTopics: [
        {
          topic: 'archived-topic',
          status: '✅ complete',
          stage: 'qa',
          yggPoint: '1.00',
          description: 'archive description',
          version: '0.3.5',
          latest: 'latest',
          date: '2026-04-16',
        },
      ],
    })

    expect(snapshot.activeCount).toBe(1)
    expect(snapshot.completedCount).toBe(1)
    expect(snapshot.totalCount).toBe(2)
    expect(snapshot.activeRows[0]?.id).toBe('active-topic')
    expect(snapshot.archiveRows[0]?.id).toBe('archived-topic')
    expect(snapshot.latestArchiveVersion).toBe('v0.3.5')
    expect(snapshot.isCompletelyEmpty).toBe(false)
  })
})
