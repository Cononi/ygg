import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { archiveTopic } from '../core/archive-topic.js'
import { readChangeIndex } from '../core/change-index.js'
import { logger } from '../utils/logger.js'
import {
  defaultRunCommand,
  detectVerificationSteps,
  excerptOutput,
  type CommandExecutionResult,
  type RunCommand,
  type VerificationStep,
} from '../utils/verification.js'

export interface QaDependencies {
  now?: () => Date
  runCommand?: RunCommand
}

interface TaskChecklistSummary {
  readonly total: number
  readonly completed: number
  readonly open: number
}

function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function summarizeTasks(markdown: string): TaskChecklistSummary {
  const matches = Array.from(markdown.matchAll(/^- \[([ xX])\] .+$/gm))
  const total = matches.length
  const completed = matches.filter((match) => (match[1] ?? '').toLowerCase() === 'x').length
  return {
    total,
    completed,
    open: total - completed,
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function findActiveAddTopic(projectRoot: string): Promise<{ topic: string } | null> {
  const index = await readChangeIndex(projectRoot)
  const candidates = index.topics
    .filter((entry) => entry.stage === 'add')
    .sort((a, b) => b.date.localeCompare(a.date) || a.topic.localeCompare(b.topic))

  const selected = candidates[0]
  return selected ? { topic: selected.topic } : null
}

function buildQaReport(
  topic: string,
  taskSummary: TaskChecklistSummary,
  results: Array<{ step: VerificationStep; result: CommandExecutionResult }>,
  docsPresent: boolean,
): string {
  return [
    `# QA Report: ${topic}`,
    '',
    '## Tasks Check',
    taskSummary.open === 0
      ? `- PASS: ${taskSummary.completed}/${taskSummary.total} task checklist complete`
      : `- FAIL: ${taskSummary.completed}/${taskSummary.total} task checklist complete`,
    '',
    '## Spec Cross-check',
    docsPresent
      ? '- PASS: design.md and specs/spec-core/spec.md are present'
      : '- FAIL: required design/spec documents are missing',
    '',
    '## Verification',
    ...(results.length > 0
      ? results.flatMap(({ step, result }) => [
          `### ${step.name}`,
          `- Command: \`${[step.command, ...step.args].join(' ')}\``,
          `- Result: ${result.success ? 'PASS' : `FAIL (exit ${result.exitCode ?? 'unknown'})`}`,
          '```text',
          ...excerptOutput(result.stdout, result.stderr),
          '```',
          '',
        ])
      : ['- SKIP: no supported build tool detected', '']),
  ].join('\n')
}

export async function runQa(
  projectRoot: string,
  deps: QaDependencies = {},
): Promise<void> {
  const activeTopic = await findActiveAddTopic(projectRoot)
  if (!activeTopic) {
    throw new Error('No active add-stage topic found. Run ygg add first.')
  }

  const topicDir = join(projectRoot, 'ygg', 'change', activeTopic.topic)
  const tasksPath = join(topicDir, 'tasks.md')
  const designPath = join(topicDir, 'design.md')
  const specPath = join(topicDir, 'specs', 'spec-core', 'spec.md')

  const tasksMarkdown = await readFile(tasksPath, 'utf-8')
  const taskSummary = summarizeTasks(tasksMarkdown)
  const docsPresent = await fileExists(designPath) && await fileExists(specPath)
  const steps = await detectVerificationSteps(projectRoot)
  const runCommand = deps.runCommand ?? defaultRunCommand
  const results: Array<{ step: VerificationStep; result: CommandExecutionResult }> = []

  for (const step of steps) {
    logger.info(`Running ${step.name}: ${[step.command, ...step.args].join(' ')}`)
    const result = await runCommand(step.command, step.args, projectRoot)
    results.push({ step, result })
    if (!result.success) {
      logger.warn(`${step.name} failed for topic: ${activeTopic.topic}`)
      break
    }
  }

  const date = formatDate(deps.now?.() ?? new Date())
  const reportPath = join(topicDir, `qa-${date}.md`)
  await writeFile(reportPath, buildQaReport(activeTopic.topic, taskSummary, results, docsPresent), 'utf-8')

  const allCommandsPassed = results.every(({ result }) => result.success)
  const canArchive = taskSummary.open === 0 && docsPresent && allCommandsPassed

  if (!canArchive) {
    throw new Error(`QA failed for ${activeTopic.topic}. See ${reportPath}`)
  }

  const archiveResult = await archiveTopic(projectRoot, activeTopic.topic)
  logger.success(`QA passed and archived ${activeTopic.topic} → v${archiveResult.projectVersion}`)
}
