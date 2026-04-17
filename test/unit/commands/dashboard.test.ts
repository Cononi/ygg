import { describe, expect, it, vi } from 'vitest'

import { getPackageRoot, resolveDashboardProjectRoot } from '../../../src/utils/project-root.js'

describe('dashboard project root resolution', () => {
  it('returns process cwd when it is available', () => {
    const root = resolveDashboardProjectRoot(() => '/tmp/active-project')

    expect(root).toBe('/tmp/active-project')
  })

  it('falls back to the package root when cwd is invalid', () => {
    const root = resolveDashboardProjectRoot(() => {
      const error = new Error('ENOENT: no such file or directory, uv_cwd') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    })

    expect(root).toBe(getPackageRoot())
  })

  it('rethrows non-cwd failures', () => {
    expect(() => resolveDashboardProjectRoot(() => {
      throw new Error('permission denied')
    })).toThrow('permission denied')
  })
})
