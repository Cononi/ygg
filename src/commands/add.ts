import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { readChangeIndex, writeChangeIndex } from '../core/change-index.js'
import { fileExists } from '../utils/file-writer.js'
import { promptInput, selectOption } from '../utils/interactive.js'
import { logger } from '../utils/logger.js'
import {
  defaultRunCommand,
  detectVerificationSteps,
  excerptOutput,
  selectVerificationStepsForTask,
  type RunCommand,
} from '../utils/verification.js'
import { runQa, type QaDependencies } from './qa.js'

export interface AddDependencies {
  now?: () => Date
  selectOption?: (prompt: string, options: readonly { value: string; label: string }[]) => Promise<string | null>
  implementTask?: (task: AddTaskContext) => Promise<AddTaskExecutionResult | null>
  runCommand?: RunCommand
  runQa?: (projectRoot: string, deps?: QaDependencies) => Promise<void>
}

interface TaskChecklistSummary {
  readonly total: number
  readonly completed: number
  readonly open: number
}

interface ParsedTaskItem {
  readonly lineIndex: number
  readonly section: string
  readonly text: string
  readonly checked: boolean
}

export interface AddTaskContext {
  readonly projectRoot: string
  readonly topic: string
  readonly topicDir: string
  readonly section: string
  readonly text: string
  readonly tasksPath: string
  readonly designPath: string
  readonly specPath: string
  readonly yggPointPath: string
  readonly logPath: string
  readonly runCommand: RunCommand
}

export interface AddTaskExecutionResult {
  readonly completed: boolean
  readonly note?: string
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

async function ensureFile(path: string, message: string): Promise<void> {
  try {
    const info = await stat(path)
    if (!info.isFile()) {
      throw new Error(message)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(message)
    }
    throw error
  }
}

async function findActiveImplementationTopic(
  projectRoot: string,
): Promise<{ topic: string; description: string; yggPoint: string } | null> {
  const index = await readChangeIndex(projectRoot)
  const candidates = index.topics
    .filter((entry) => entry.stage === 'next' || entry.stage === 'add')
    .sort((a, b) => b.date.localeCompare(a.date) || a.topic.localeCompare(b.topic))

  const selected = candidates[0]
  return selected
    ? {
        topic: selected.topic,
        description: selected.description,
        yggPoint: selected.yggPoint,
      }
    : null
}

function parseTaskItems(markdown: string): ParsedTaskItem[] {
  const lines = markdown.split('\n')
  const tasks: ParsedTaskItem[] = []
  let currentSection = 'General'

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? ''
    const sectionMatch = line.match(/^\d+\.\s+(.+)$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]?.trim() ?? currentSection
      continue
    }

    const taskMatch = line.match(/^- \[([ xX])\] (.+)$/)
    if (!taskMatch) continue

    tasks.push({
      lineIndex: index,
      section: currentSection,
      text: taskMatch[2]?.trim() ?? '',
      checked: (taskMatch[1] ?? '').toLowerCase() === 'x',
    })
  }

  return tasks
}

function markTasksComplete(markdown: string, taskLineIndexes: readonly number[]): string {
  if (taskLineIndexes.length === 0) return markdown

  const lineIndexSet = new Set(taskLineIndexes)
  const lines = markdown.split('\n')
  const updated = lines.map((line, index) => {
    if (!lineIndexSet.has(index)) return line
    return line.replace(/^- \[ \] /, '- [x] ')
  })
  return updated.join('\n')
}

function buildDailyLog(
  topic: string,
  description: string,
  summary: TaskChecklistSummary,
  completedTasks: readonly string[],
  pendingTasks: readonly string[],
): string {
  return [
    `# Change Log: ${topic}`,
    '',
    '## Why',
    `- ${description}`,
    '',
    '## Spec',
    '- design.md, specs/spec-core/spec.md, tasks.md를 기준으로 구현을 진행한다.',
    '',
    '## Changes',
    '- 이 파일은 ygg-add 단계에서 task를 읽고 반영한 작업 로그다.',
    `- 현재 task checklist: ${summary.completed}/${summary.total} 완료`,
    '',
    '## Completed',
    ...(completedTasks.length > 0
      ? completedTasks.map((task) => `- ${task}`)
      : ['- 이번 실행에서 자동 완료된 task 없음']),
    '',
    '## Pending',
    ...(pendingTasks.length > 0
      ? pendingTasks.map((task) => `- ${task}`)
      : ['- 남은 task 없음']),
    '',
  ].join('\n')
}

async function updateTopicStage(
  projectRoot: string,
  topic: string,
  yggPoint: string,
  description: string,
  date: string,
): Promise<void> {
  const index = await readChangeIndex(projectRoot)
  index.topics = index.topics.filter((entry) => entry.topic !== topic)
  index.topics.push({
    topic,
    status: '🔄 진행중',
    stage: 'add',
    yggPoint,
    description,
    date,
  })
  await writeChangeIndex(projectRoot, index)
}

async function executeBuiltInTask(context: AddTaskContext): Promise<AddTaskExecutionResult | null> {
  const normalized = context.text.toLowerCase()

  if ((normalized.includes('design.md') || normalized.includes('design')) && await fileExists(context.designPath)) {
    return { completed: true, note: 'design artifact present' }
  }

  if ((normalized.includes('spec.md') || normalized.includes('specs/spec-core/spec.md')) && await fileExists(context.specPath)) {
    return { completed: true, note: 'spec artifact present' }
  }

  if (normalized.includes('tasks.md') && /(정리|생성|organize|generate|작성)/i.test(context.text) && await fileExists(context.tasksPath)) {
    return { completed: true, note: 'tasks artifact present' }
  }

  if ((normalized.includes('snapshot') || normalized.includes('ygg-point')) && await fileExists(context.yggPointPath)) {
    const yggPoint = JSON.parse(await readFile(context.yggPointPath, 'utf-8')) as {
      currentStage?: string
      stages?: { next?: object }
    }
    if (yggPoint.currentStage === 'next' || yggPoint.currentStage === 'add' || yggPoint.stages?.next) {
      return { completed: true, note: 'ygg-point snapshot present' }
    }
  }

  if ((normalized.includes('index.md') || normalized.includes('stage')) && /(index|stage|바꾼다|갱신)/i.test(context.text)) {
    return { completed: true, note: 'index updated for add stage' }
  }

  if ((normalized.includes('change log') || normalized.includes('daily log') || normalized.includes('작업 로그') || normalized.includes('일일')) && await fileExists(context.logPath)) {
    return { completed: true, note: 'daily log present' }
  }

  const availableSteps = await detectVerificationSteps(context.projectRoot)
  const selectedSteps = selectVerificationStepsForTask(context.text, availableSteps)
  if (selectedSteps.length > 0) {
    const outputs: string[] = []
    for (const step of selectedSteps) {
      logger.info(`Running ${step.name} for add task: ${[step.command, ...step.args].join(' ')}`)
      const result = await context.runCommand(step.command, step.args, context.projectRoot)
      outputs.push(`${step.name}: ${result.success ? 'PASS' : `FAIL (${result.exitCode ?? 'unknown'})`}`)
      if (!result.success) {
        return {
          completed: false,
          note: `${outputs.join(', ')} | ${excerptOutput(result.stdout, result.stderr).join(' / ')}`,
        }
      }
    }
    return {
      completed: true,
      note: outputs.join(', '),
    }
  }

  return null
}

export async function runAdd(
  projectRoot: string,
  deps: AddDependencies = {},
): Promise<void> {
  const activeTopic = await findActiveImplementationTopic(projectRoot)
  if (!activeTopic) {
    throw new Error('No active next/add-stage topic found. Run ygg next first.')
  }

  const now = deps.now?.() ?? new Date()
  const date = formatDate(now)
  const topicDir = join(projectRoot, 'ygg', 'change', activeTopic.topic)
  const designPath = join(topicDir, 'design.md')
  const tasksPath = join(topicDir, 'tasks.md')
  const specPath = join(topicDir, 'specs', 'spec-core', 'spec.md')
  const yggPointPath = join(topicDir, 'ygg-point.json')
  const logPath = join(topicDir, `${date}.md`)
  const runCommand = deps.runCommand ?? defaultRunCommand

  await ensureFile(designPath, `Missing design.md for topic: ${activeTopic.topic}`)
  await ensureFile(tasksPath, `Missing tasks.md for topic: ${activeTopic.topic}`)
  await ensureFile(specPath, `Missing spec.md for topic: ${activeTopic.topic}`)

  await mkdir(topicDir, { recursive: true })
  await updateTopicStage(projectRoot, activeTopic.topic, activeTopic.yggPoint, activeTopic.description, date)

  let tasksMarkdown = await readFile(tasksPath, 'utf-8')
  let taskItems = parseTaskItems(tasksMarkdown)
  const initialSummary = summarizeTasks(tasksMarkdown)

  logger.success(`Prepared add-stage workflow for topic: ${activeTopic.topic}`)
  logger.info(`Task progress before add: ${initialSummary.completed}/${initialSummary.total} complete`)

  const implementationMode = initialSummary.open === 0
    ? [
        { value: 'qa', label: '1. ygg-qa 실행 (Recommended) — 모든 task가 완료되어 바로 검증 가능' },
        { value: 'stop', label: '2. 여기서 멈춤 — add stage 상태만 저장' },
      ]
    : [
        { value: 'implement-all', label: '1. open task 모두 처리 시도 (Recommended)' },
        { value: 'implement-auto', label: '2. 자동 반영 가능한 task만 처리' },
        { value: 'stop', label: '3. 여기서 멈춤 — add stage 상태만 저장' },
      ]

  const selectedMode = await selectOption(
    '구현 방식을 선택하세요.',
    implementationMode,
    promptInput,
    deps.selectOption,
  )

  const completedThisRun: string[] = []
  if (selectedMode === 'implement-all' || selectedMode === 'implement-auto') {
    const openTasks = taskItems.filter((task) => !task.checked)

    for (const task of openTasks) {
      const context: AddTaskContext = {
        projectRoot,
        topic: activeTopic.topic,
        topicDir,
        section: task.section,
        text: task.text,
        tasksPath,
        designPath,
        specPath,
        yggPointPath,
        logPath,
        runCommand,
      }

      let result: AddTaskExecutionResult | null = null
      if (deps.implementTask && selectedMode === 'implement-all') {
        result = await deps.implementTask(context)
      }
      if (!result) {
        result = await executeBuiltInTask(context)
      }

      if (result?.completed) {
        completedThisRun.push(result.note
          ? `${task.section}: ${task.text} (${result.note})`
          : `${task.section}: ${task.text}`)
        tasksMarkdown = markTasksComplete(tasksMarkdown, [task.lineIndex])
        taskItems = parseTaskItems(tasksMarkdown)
      }
    }

    await writeFile(tasksPath, tasksMarkdown, 'utf-8')
  }

  const summary = summarizeTasks(tasksMarkdown)
  const pendingTasks = parseTaskItems(tasksMarkdown)
    .filter((task) => !task.checked)
    .map((task) => `${task.section}: ${task.text}`)

  await writeFile(
    logPath,
    buildDailyLog(activeTopic.topic, activeTopic.description, summary, completedThisRun, pendingTasks),
    'utf-8',
  )

  logger.info(`Task progress after add: ${summary.completed}/${summary.total} complete`)

  const options = summary.open === 0
    ? [
        { value: 'qa', label: '1. ygg-qa 실행 (Recommended) — 검증 후 통과 시 archive' },
        { value: 'stop', label: '2. 여기서 멈춤 — add stage 상태만 저장' },
      ]
    : [
        { value: 'stop', label: '1. 구현 계속 (Recommended) — 아직 완료되지 않은 task가 남아 있음' },
        { value: 'qa', label: '2. ygg-qa 시도 — 현재 상태로 검증 실행' },
      ]

  const nextAction = await selectOption(
    '다음 단계로 진행할까요?',
    options,
    promptInput,
    deps.selectOption,
  )

  if (nextAction === 'qa') {
    const runQaImpl = deps.runQa ?? runQa
    await runQaImpl(projectRoot, { now: deps.now })
  }
}
