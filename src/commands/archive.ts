import { archiveTopic } from '../core/archive-topic.js'
import { logger } from '../utils/logger.js'

export async function runArchive(projectRoot: string, topic: string): Promise<void> {
  const result = await archiveTopic(projectRoot, topic)
  logger.success(`Archived ${topic} [${result.archiveType}] → v${result.projectVersion} (${result.archiveDate})`)
}
