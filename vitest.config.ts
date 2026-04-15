import { defineConfig } from 'vitest/config'
import os from 'node:os'

function resolveMaxWorkers(): number {
  const raw = process.env.VITEST_MAX_WORKERS
  if (raw) {
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  // CLI 테스트는 자식 프로세스를 많이 생성하므로 CPU 수 기반으로 캡
  const cpuCount =
    typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus().length

  return Math.min(4, Math.max(1, cpuCount))
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // 각 테스트 파일을 별도 Node 프로세스로 실행
    // → process.cwd(), env, 파일시스템 상태가 완전히 격리됨
    pool: 'forks',
    maxWorkers: resolveMaxWorkers(),

    // 전체 suite 시작/종료 시 1회 실행 (임시 디렉토리 생성/정리 등)
    globalSetup: './vitest.setup.ts',

    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'bin'],

    // CLI 실행, 파일 I/O는 기본 5초로 부족할 수 있음
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 3000,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'bin/',           // CLI 진입점은 커버리지 제외
        '*.config.ts',
        'test/**',
      ],
    },
  },
})