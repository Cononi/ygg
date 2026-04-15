import { resolve } from 'node:path'

import { readConfigDashboardPort, writeConfigDashboardPort } from '../i18n/config.js'
import { addProject, removeProject } from '../server/registry.js'
import { logger } from '../utils/logger.js'

const DEFAULT_PORT = 4242

export interface DashboardServeOptions {
  port?: number
  open: boolean
}

/** ygg dashboard — 웹 대시보드 서버 시작 */
export async function runDashboard(projectRoot: string, options: DashboardServeOptions): Promise<void> {
  const { createServer } = await import('../server/index.js')
  const openBrowser = await import('open')

  // 포트 우선순위: --port 플래그 > config.yml dashboard.port > 기본값 4242
  const configPort = await readConfigDashboardPort(projectRoot)
  const finalPort = options.port ?? configPort ?? DEFAULT_PORT

  const server = await createServer()
  const url = `http://localhost:${finalPort}`

  await server.listen({ port: finalPort, host: '127.0.0.1' })
  logger.success(`Dashboard running at ${url}`)
  if (configPort && !options.port) {
    logger.info(`(Using saved port from config. Run \`ygg dashboard port\` to change.)`)
  }
  logger.info('Press Ctrl+C to stop')

  if (options.open) {
    await openBrowser.default(url)
  }

  // graceful shutdown
  process.on('SIGINT', () => {
    void server.close().then(() => process.exit(0))
  })
}

/** ygg dashboard port [number] — 대시보드 기본 포트 설정/조회 */
export async function runDashboardPort(projectRoot: string, portArg?: string): Promise<void> {
  if (!portArg) {
    // 현재 설정 포트 표시
    const configPort = await readConfigDashboardPort(projectRoot)
    if (configPort) {
      logger.info(`Dashboard port: ${configPort} (saved in ygg/config.yml)`)
    } else {
      logger.info(`Dashboard port: ${DEFAULT_PORT} (default, not saved)`)
    }
    logger.info('Usage: ygg dashboard port <number>')
    return
  }

  const port = parseInt(portArg, 10)
  if (isNaN(port) || port < 1 || port > 65535) {
    logger.error(`Invalid port: "${portArg}". Must be a number between 1 and 65535.`)
    process.exitCode = 1
    return
  }

  await writeConfigDashboardPort(projectRoot, port)
  logger.success(`Dashboard port set to ${port} (saved in ygg/config.yml)`)
  logger.info(`Run \`ygg dashboard serve\` to start on port ${port}`)
}

/** ygg dashboard add <path> — registry에 프로젝트 추가 */
export async function runDashboardAdd(projectPath: string): Promise<void> {
  const { version } = await import('../../package.json', { with: { type: 'json' } })
  const normalizedPath = resolve(projectPath)
  const entry = await addProject(normalizedPath, version)
  logger.success(`Registered project: ${entry.path} (id: ${entry.id})`)
}

/** ygg dashboard remove <path> — registry에서 프로젝트 제거 */
export async function runDashboardRemove(projectPath: string): Promise<void> {
  const normalizedPath = resolve(projectPath)
  const removed = await removeProject(normalizedPath)
  if (removed) {
    logger.success(`Removed project: ${normalizedPath}`)
  } else {
    logger.warn(`Project not found in registry: ${normalizedPath}`)
  }
}
