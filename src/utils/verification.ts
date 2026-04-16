import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface CommandExecutionResult {
  readonly success: boolean
  readonly exitCode: number | null
  readonly stdout: string
  readonly stderr: string
}

export interface VerificationStep {
  readonly name: string
  readonly command: string
  readonly args: string[]
}

export type RunCommand = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<CommandExecutionResult>

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export function excerptOutput(stdout: string, stderr: string): string[] {
  const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
  if (!combined) {
    return ['(no output)']
  }

  return combined
    .split('\n')
    .slice(-8)
    .map((line) => line.trim())
    .filter(Boolean)
}

export async function defaultRunCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<CommandExecutionResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (exitCode) => {
      resolve({
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr,
      })
    })
  })
}

export async function detectVerificationSteps(projectRoot: string): Promise<VerificationStep[]> {
  const packageJsonPath = join(projectRoot, 'package.json')
  if (await fileExists(packageJsonPath)) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
      scripts?: Record<string, string>
    }
    const scripts = packageJson.scripts ?? {}
    const steps: VerificationStep[] = []
    if (scripts.build) steps.push({ name: 'Build', command: 'pnpm', args: ['build'] })
    if (scripts.lint) steps.push({ name: 'Lint', command: 'pnpm', args: ['lint'] })
    if (scripts.typecheck) steps.push({ name: 'Typecheck', command: 'pnpm', args: ['typecheck'] })
    if (scripts.test) steps.push({ name: 'Test', command: 'pnpm', args: ['test'] })
    if (steps.length > 0) return steps
  }

  if (await fileExists(join(projectRoot, 'Cargo.toml'))) {
    return [
      { name: 'Build', command: 'cargo', args: ['build'] },
      { name: 'Lint', command: 'cargo', args: ['clippy'] },
      { name: 'Test', command: 'cargo', args: ['test'] },
    ]
  }

  if (await fileExists(join(projectRoot, 'pyproject.toml'))) {
    return [
      { name: 'Lint', command: 'ruff', args: ['check', '.'] },
      { name: 'Test', command: 'pytest', args: [] },
    ]
  }

  if (await fileExists(join(projectRoot, 'Makefile'))) {
    return [
      { name: 'Build', command: 'make', args: [] },
      { name: 'Lint', command: 'make', args: ['lint'] },
      { name: 'Test', command: 'make', args: ['test'] },
    ]
  }

  return []
}

export function selectVerificationStepsForTask(
  taskText: string,
  availableSteps: readonly VerificationStep[],
): VerificationStep[] {
  const normalized = taskText.toLowerCase()
  const selected: VerificationStep[] = []

  const wantsBuild = /build|빌드/.test(normalized)
  const wantsLint = /lint|eslint|ruff|clippy/.test(normalized)
  const wantsTypecheck = /typecheck|type check|tsc|타입/.test(normalized)
  const wantsTest = /test|tests|unit test|vitest|pytest|jest|테스트|검증/.test(normalized)

  if (!wantsBuild && !wantsLint && !wantsTypecheck && !wantsTest) {
    return []
  }

  for (const step of availableSteps) {
    const stepName = step.name.toLowerCase()
    if (wantsBuild && stepName === 'build') selected.push(step)
    if (wantsLint && stepName === 'lint') selected.push(step)
    if (wantsTypecheck && stepName === 'typecheck') selected.push(step)
    if (wantsTest && stepName === 'test') selected.push(step)
  }

  return selected
}
