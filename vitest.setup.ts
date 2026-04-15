import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

declare global {
  var TEST_TMP_DIR: string
}

export async function setup(): Promise<void> {
  // 1. 빌드 산출물 보장
  execSync('pnpm build', { stdio: 'pipe' })

  // 2. 공유 임시 디렉토리 생성
  globalThis.TEST_TMP_DIR = await mkdtemp(join(tmpdir(), 'ygg-test-'))
}

export async function teardown(): Promise<void> {
  // 1. 임시 디렉토리 정리
  await rm(globalThis.TEST_TMP_DIR, { recursive: true, force: true })

  // 2. open handle로 인한 hang 방지
  setTimeout(() => {
    process.exit(0)
  }, 1000).unref()
}
