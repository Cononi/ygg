import { describe, expect, it } from 'vitest'

import { shouldUseHistoryBack } from '../../../packages/dashboard/src/utils/navigation.js'

describe('dashboard navigation helpers', () => {
  it('uses browser history when there is prior navigation context', () => {
    expect(shouldUseHistoryBack(2, 'abc123')).toBe(true)
  })

  it('falls back to home when opened directly in a fresh entry', () => {
    expect(shouldUseHistoryBack(1, 'default')).toBe(false)
    expect(shouldUseHistoryBack(2, 'default')).toBe(false)
  })
})
