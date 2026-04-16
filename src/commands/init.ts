import { writeFile, readFile, mkdir, copyFile, chmod, readdir } from 'node:fs/promises'
import { resolve, join, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SUPPORTED_TARGETS, type SupportedTarget, writeConfigTargets } from '../i18n/config.js'
import { resolveLanguage } from '../i18n/index.js'
import { addProject } from '../server/registry.js'
import { fileExists } from '../utils/file-writer.js'
import { logger } from '../utils/logger.js'
import { getPackageVersion } from '../utils/package-version.js'

/** 패키지 루트의 templates/ 디렉토리를 가리킨다
 * - dist/cli.js (번들) → ../templates
 * - src/commands/init.ts (개발) → ../../templates
 */
const __dir = dirname(fileURLToPath(import.meta.url))
export const PACKAGE_ROOT = __dir.includes(`${sep}src${sep}`) ? resolve(__dir, '../..') : resolve(__dir, '..')
export const TEMPLATES_DIR = join(PACKAGE_ROOT, 'templates')
export const INIT_TEMPLATES_DIR = join(TEMPLATES_DIR, 'init')
export const AGENT_DOC_FILENAMES = {
  shared: 'agent.md',
  claude: 'CLAUDE.md',
  codex: 'AGENTS.md',
} as const

export const YGG_COMMANDS = ['add', 'create', 'next', 'point', 'prove', 'qa', 'status', 'teams']

/** 언어별 템플릿 디렉토리를 반환한다. templates/init/{lang}/ */
export function getLangDir(lang: string): string {
  return join(INIT_TEMPLATES_DIR, lang)
}

function getAgentDocsDir(lang: string): string {
  return join(getLangDir(lang), 'agent-docs')
}
export const YGG_SKILLS = ['ygg-core', 'ygg-create', 'ygg-status', 'ygg-next', 'ygg-prove', 'ygg-add', 'ygg-qa', 'ygg-teams']
export const HOOK_SCRIPTS = ['ygg-scope-check.sh', 'ygg-track-change.sh', 'ygg-progress-check.sh', 'ygg-prove.sh', 'ygg-log-change.sh']

export interface InitOptions {
  /** Claude 대상 디렉토리 구조 생성 건너뛰기 */
  skipClaude?: boolean
  /** 생성 대상 환경 */
  targets?: SupportedTarget[]
}

/** init 커맨드: 프로젝트에 대상 워크플로우 디렉토리 + ygg/change/ 구조 생성 */
export async function runInit(projectRoot: string, options: InitOptions): Promise<void> {
  const lang = await resolveLanguage(projectRoot)
  const targets = await resolveInitTargets(options)

  await scaffoldYggWorkspace(projectRoot)
  await writeConfigTargets(projectRoot, targets)
  if (targets.includes('claude')) {
    await scaffoldWorkflowAssets(projectRoot, lang)
  }
  if (targets.includes('codex')) {
    await scaffoldCodexAssets(projectRoot, lang)
  }

  await scaffoldAgentDocs(projectRoot, lang, targets)

  // registry에 프로젝트 자동 등록
  const version = getPackageVersion()
  await addProject(projectRoot, version)

  logger.success(`Initialized @cono-ai/ygg in ${projectRoot}`)
  logger.info('Next steps:')
  if (targets.includes('claude')) {
    logger.info('  1. /ygg:create <설명>  — 지원 대상 AI에서 proposal 생성')
    logger.info('  2. /ygg:next           — design + spec + tasks 수립')
  }
  if (targets.includes('codex')) {
    logger.info('  3. AGENTS.md + ygg/agent.md 기준으로 Codex 작업 시작')
  }
  logger.info(`  Targets: ${targets.join(', ')}`)
}

/** 워크플로우 자산 생성: commands, skills, agents, hooks */
async function scaffoldWorkflowAssets(projectRoot: string, lang: string): Promise<void> {
  const claudeDir = join(projectRoot, '.claude')
  const langDir = getLangDir(lang)
  const commands = await listTemplateCommands(lang)
  const skills = await listTemplateSkills(lang)
  const scripts = await listTemplateScripts()
  const agents = await listTemplateAgents(lang)

  // 디렉토리 생성
  const dirs = [
    join(claudeDir, 'agents'),
    join(claudeDir, 'commands', 'ygg'),
    join(claudeDir, 'scripts'),
    ...skills.map(skill => join(claudeDir, 'skills', skill)),
  ]
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true })
  }

  // Agents: templates/init/{lang}/agents/ 전체 스캔 (.md 필터)
  for (const agentFile of agents) {
    await copyIfNotExists(
      join(langDir, 'agents', agentFile),
      join(claudeDir, 'agents', agentFile),
      `.claude/agents/${agentFile}`,
    )
  }

  // Commands: ygg/ 네임스페이스 (→ /ygg:create, /ygg:status, etc.)
  for (const cmd of commands) {
    await copyIfNotExists(
      join(langDir, 'commands', 'ygg', `${cmd}.md`),
      join(claudeDir, 'commands', 'ygg', `${cmd}.md`),
      `.claude/commands/ygg/${cmd}.md`,
    )
  }

  // Skills: ygg-core + command 1:1 매칭
  for (const skill of skills) {
    await copyIfNotExists(
      join(langDir, 'skills', skill, 'SKILL.md'),
      join(claudeDir, 'skills', skill, 'SKILL.md'),
      `.claude/skills/${skill}/SKILL.md`,
    )
  }

  // Hook scripts: .claude/scripts/
  for (const script of scripts) {
    await copyIfNotExists(
      join(INIT_TEMPLATES_DIR, 'scripts', script),
      join(claudeDir, 'scripts', script),
      `.claude/scripts/${script}`,
    )
  }
  // 스크립트 실행 권한 부여
  for (const script of scripts) {
    const scriptPath = join(claudeDir, 'scripts', script)
    if (await fileExists(scriptPath)) {
      await chmod(scriptPath, 0o755)
    }
  }

  // Hooks: settings.json (병합)
  await mergeSettingsJson(projectRoot)

}

async function scaffoldCodexAssets(projectRoot: string, lang: string): Promise<void> {
  const codexDir = join(projectRoot, '.codex', 'skills')
  const skills = await listTemplateSkills(lang)

  await mkdir(codexDir, { recursive: true })

  for (const skill of skills) {
    const dest = join(codexDir, skill, 'SKILL.md')
    if (await fileExists(dest)) {
      logger.warn(`.codex/skills/${skill}/SKILL.md already exists. Skipping.`)
      continue
    }

    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, await renderCodexSkill(skill, lang), 'utf-8')
    logger.success(`Created .codex/skills/${skill}/SKILL.md`)
  }
}

/** 루트 에이전트 문서 생성: 공통 가이드 + 대상별 엔트리 */
async function scaffoldAgentDocs(projectRoot: string, lang: string, targets: SupportedTarget[]): Promise<void> {
  const docsDir = getAgentDocsDir(lang)
  const yggDir = join(projectRoot, 'ygg')

  await mkdir(yggDir, { recursive: true })

  await copyIfNotExists(
    join(docsDir, 'shared.md'),
    join(yggDir, AGENT_DOC_FILENAMES.shared),
    `ygg/${AGENT_DOC_FILENAMES.shared}`,
  )
  if (targets.includes('claude')) {
    await copyIfNotExists(
      join(docsDir, 'CLAUDE.md'),
      join(projectRoot, AGENT_DOC_FILENAMES.claude),
      AGENT_DOC_FILENAMES.claude,
    )
  }
  if (targets.includes('codex')) {
    const codexDocPath = join(projectRoot, AGENT_DOC_FILENAMES.codex)
    if (await fileExists(codexDocPath)) {
      logger.warn(`${AGENT_DOC_FILENAMES.codex} already exists. Skipping.`)
    } else {
      await writeFile(codexDocPath, await renderCodexDoc(lang), 'utf-8')
      logger.success(`Created ${AGENT_DOC_FILENAMES.codex}`)
    }
  }
}

async function resolveInitTargets(options: InitOptions): Promise<SupportedTarget[]> {
  if (options.targets && options.targets.length > 0) {
    return normalizeTargets(options.targets)
  }

  if (options.skipClaude) {
    return ['codex']
  }

  if (!process.stdin.isTTY) {
    throw new Error('ygg init requires an interactive terminal or --targets <claude,codex>')
  }

  const selected = await promptTargetSelection()
  if (selected.length === 0) {
    throw new Error('At least one target must be selected.')
  }
  return selected
}

function normalizeTargets(targets: SupportedTarget[]): SupportedTarget[] {
  return Array.from(new Set(targets)).filter(
    (target): target is SupportedTarget =>
      (SUPPORTED_TARGETS as readonly string[]).includes(target),
  )
}

async function promptTargetSelection(): Promise<SupportedTarget[]> {
  const options = [
    { value: 'claude' as const, label: 'Claude Code (.claude/, CLAUDE.md)' },
    { value: 'codex' as const, label: 'Codex (AGENTS.md)' },
  ]

  logger.info('초기화할 환경을 선택하세요 (↑↓ 이동, Space 토글, Enter 확인, Ctrl+C 취소):')
  return multiSelect(options)
}

async function multiSelect(
  options: Array<{ value: SupportedTarget; label: string }>,
): Promise<SupportedTarget[]> {
  if (options.length === 0) return []

  let index = 0
  const selected = new Set<SupportedTarget>()

  const renderMenu = () => {
    process.stdout.write(`\x1B[${options.length}A\x1B[0J`)
    for (let i = 0; i < options.length; i++) {
      const marker = i === index ? '▶' : ' '
      const checked = selected.has(options[i].value) ? '[x]' : '[ ]'
      process.stdout.write(`  ${marker} ${checked} ${options[i].label}\n`)
    }
  }

  for (const opt of options) {
    const checked = selected.has(opt.value) ? '[x]' : '[ ]'
    process.stdout.write(`    ${checked} ${opt.label}\n`)
  }
  renderMenu()

  return new Promise((resolve) => {
    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()

    const onData = (buf: Buffer) => {
      const b0 = buf[0]
      const b1 = buf[1]
      const b2 = buf[2]

      if (b0 === 0x03 || b0 === 0x71) {
        cleanup()
        resolve([])
        return
      }
      if (b0 === 0x0D || b0 === 0x0A) {
        cleanup()
        resolve(Array.from(selected))
        return
      }
      if (b0 === 0x20) {
        const current = options[index].value
        if (selected.has(current)) selected.delete(current)
        else selected.add(current)
        renderMenu()
        return
      }
      if (b0 === 0x1B && b1 === 0x5B && b2 === 0x41) {
        index = (index - 1 + options.length) % options.length
        renderMenu()
        return
      }
      if (b0 === 0x1B && b1 === 0x5B && b2 === 0x42) {
        index = (index + 1) % options.length
        renderMenu()
      }
    }

    const cleanup = () => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
    }

    stdin.on('data', onData)
  })
}

export async function listTemplateCommands(lang: string): Promise<string[]> {
  const commandsDir = join(getLangDir(lang), 'commands', 'ygg')
  if (!await fileExists(commandsDir)) {
    return YGG_COMMANDS
  }

  return (await readdir(commandsDir))
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => entry.slice(0, -3))
    .sort()
}

export async function listTemplateSkills(lang: string): Promise<string[]> {
  const skillsDir = join(getLangDir(lang), 'skills')
  if (!await fileExists(skillsDir)) {
    return YGG_SKILLS
  }

  const entries = await readdir(skillsDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

export async function listTemplateAgents(lang: string): Promise<string[]> {
  const agentsDir = join(getLangDir(lang), 'agents')
  if (!await fileExists(agentsDir)) {
    return []
  }

  return (await readdir(agentsDir))
    .filter((entry) => entry.endsWith('.md'))
    .sort()
}

export async function listTemplateScripts(): Promise<string[]> {
  const scriptsDir = join(INIT_TEMPLATES_DIR, 'scripts')
  if (!await fileExists(scriptsDir)) {
    return HOOK_SCRIPTS
  }

  return (await readdir(scriptsDir))
    .filter((entry) => entry.endsWith('.sh'))
    .sort()
}

interface TemplateFrontmatter {
  name?: string
  description?: string
  model?: string
}

export async function renderCodexDoc(lang: string): Promise<string> {
  const docsDir = getAgentDocsDir(lang)
  const baseDocPath = join(docsDir, 'AGENTS.md')
  const baseDoc = await readFile(baseDocPath, 'utf-8')

  const [skills, agents, scripts] = await Promise.all([
    renderCodexSkillIndexSection(lang),
    renderCodexAgentSection(lang),
    renderCodexScriptSection(),
  ])

  return [
    baseDoc.trim(),
    '',
    '## Codex Skills',
    '',
    'Use the generated `.codex/skills/ygg-*` files as the primary Codex workflow surface. Those files are derived from `templates/init` and contain the operational instructions for each ygg stage.',
    '',
    skills,
    '',
    '## Supporting Roles',
    '',
    'The Codex skills already embed the important review-role material below. Use this section when you need deeper context for design review or manual validation.',
    '',
    agents,
    '',
    '## Guardrails',
    '',
    'These scripts remain the source of truth for verification and workflow checks. Run them manually from Codex when the current skill calls for verification.',
    '',
    scripts,
    '',
    '## Usage Pattern',
    '',
    '- Start with `ygg/agent.md` and the active topic documents under `ygg/change/<topic>/`.',
    '- Use `.codex/skills/ygg-create/SKILL.md`, `.codex/skills/ygg-next/SKILL.md`, `.codex/skills/ygg-add/SKILL.md`, `.codex/skills/ygg-qa/SKILL.md`, and related files as the stage-by-stage playbooks.',
    '- Treat `AGENTS.md` as the overview, not the full procedure dump.',
    '- Run project tests plus any relevant ygg guardrail scripts yourself when the skill calls for verification.',
    '',
  ].join('\n')
}

export async function renderCodexSkill(skill: string, lang: string): Promise<string> {
  const skillContent = await readFile(join(getLangDir(lang), 'skills', skill, 'SKILL.md'), 'utf-8')
  const skillMeta = extractFrontmatterFields(skillContent)
  const relatedCommand = skill === 'ygg-core' ? null : skill.replace(/^ygg-/, '')
  const skillBody = stripFrontmatter(skillContent).trim()

  const body: string[] = [
    skillMeta.description || `Codex workflow skill for ${skill}.`,
    '',
    '**Input**: Accept the user request normally. If required context is missing, ask for it before proceeding.',
    '',
  ]

  if (relatedCommand) {
    body.push('## Source Mapping', '')
    body.push(`- Claude command source: \`/ygg:${relatedCommand}\``)
    body.push(`- Claude skill source: \`${skill}\``)
    body.push('- Codex behavior: perform the same workflow directly in this repository without relying on Claude-only slash commands or AskUserQuestion primitives.')
    body.push('- When a Claude step says `AskUserQuestion`, ask the user directly in plain chat and continue from the answer.')
    body.push('')
  } else {
    body.push('## Source Mapping', '')
    body.push(`- Claude skill source: \`${skill}\``)
    body.push('- Codex behavior: use this as the shared rule set for all ygg workflows in this repository.')
    body.push('- Treat Claude-only interaction instructions as conversational guidance, not tool requirements.')
    body.push('')
  }

  if (skillBody) {
    body.push(skillBody, '')
  }

  const scripts = await renderCodexScriptSection()
  body.push('## Guardrails', '', scripts.replace(/^### Scripts And Guardrails\s*/, '').trim(), '')

  return [
    '---',
    `name: ${skill}`,
    `description: ${JSON.stringify(skillMeta.description || `Codex workflow skill for ${skill}.`)}`,
    'license: MIT',
    'compatibility: Requires Codex CLI project skills.',
    'metadata:',
    '  author: ygg',
    `  sourceLang: "${lang}"`,
    '  generatedBy: "@cono-ai/ygg"',
    '---',
    '',
    ...body,
  ].join('\n')
}

function stripFrontmatter(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return normalized
  }

  const end = normalized.indexOf('\n---\n', 4)
  if (end === -1) {
    return normalized
  }

  return normalized.slice(end + 5)
}

async function renderCodexSkillIndexSection(lang: string): Promise<string> {
  const skills = await listTemplateSkills(lang)
  const lines = ['### Available Skills']

  for (const skill of skills) {
    const content = await readFile(join(getLangDir(lang), 'skills', skill, 'SKILL.md'), 'utf-8')
    const data = extractFrontmatterFields(content)
    const description = data.description ?? ''
    lines.push(`- \`${skill}\`: ${description || '(No description)'}`)
  }

  return lines.join('\n')
}

async function renderCodexAgentSection(lang: string): Promise<string> {
  const agents = await listTemplateAgents(lang)
  const lines = ['### Agents And Sub-Agent Roles']

  for (const agentFile of agents) {
    const content = await readFile(join(getLangDir(lang), 'agents', agentFile), 'utf-8')
    const data = extractFrontmatterFields(content)
    const name = data.name ?? agentFile.replace(/\.md$/, '')
    const description = data.description ?? ''
    const model = data.model ? ` (model: ${data.model})` : ''
    const criteria = extractBulletLinesFromSection(content, '## Evaluation Criteria', 4)
    lines.push(`#### ${name}${model}`)
    lines.push('')
    lines.push(description || '(No description)')
    lines.push('')
    if (criteria.length > 0) {
      lines.push('Use this role as a review checklist:')
      for (const criterion of criteria) {
        lines.push(`- ${criterion}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

function extractFrontmatterFields(content: string): TemplateFrontmatter {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---\n') && !trimmed.startsWith('---\r\n')) {
    return {}
  }

  const lines = trimmed.split('\n')
  const data: TemplateFrontmatter = {}

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue
    if (line === '---') break

    const match = line.match(/^(name|description|model):\s*(.*)$/)
    if (!match) continue

    const key = match[1] as keyof TemplateFrontmatter
    const value = match[2].trim().replace(/^['"]|['"]$/g, '')
    data[key] = value
  }

  return data
}

function extractBulletLinesFromSection(content: string, heading: string, limit: number): string[] {
  const section = extractSection(content, heading)
  if (!section) return []

  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''))
    .slice(0, limit)
}

function extractSection(content: string, heading: string): string {
  const normalized = content.replace(/\r\n/g, '\n')
  const start = normalized.indexOf(heading)
  if (start === -1) return ''

  const rest = normalized.slice(start + heading.length)
  const nextHeadingMatch = rest.match(/\n##\s+/)
  if (!nextHeadingMatch || nextHeadingMatch.index === undefined) {
    return rest.trim()
  }

  return rest.slice(0, nextHeadingMatch.index).trim()
}

async function renderCodexScriptSection(): Promise<string> {
  const scripts = await listTemplateScripts()
  const lines = ['### Scripts And Guardrails']

  for (const script of scripts) {
    const content = await readFile(join(INIT_TEMPLATES_DIR, 'scripts', script), 'utf-8')
    const firstComment = content
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('#') && !line.startsWith('#!'))
      ?.replace(/^#\s?/, '') ?? ''
    lines.push(`- \`${script}\`: ${firstComment}`)
  }

  return lines.join('\n')
}

export async function syncCodexSkills(
  projectRoot: string,
  lang: string,
): Promise<{ updated: number; skipped: number }> {
  const codexDir = join(projectRoot, '.codex', 'skills')
  const skills = await listTemplateSkills(lang)
  let updated = 0
  let skipped = 0

  for (const skill of skills) {
    const dest = join(codexDir, skill, 'SKILL.md')
    const content = await renderCodexSkill(skill, lang)

    if (await fileExists(dest)) {
      const existing = await readFile(dest, 'utf-8')
      if (existing === content) {
        skipped++
        continue
      }
    }

    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, content, 'utf-8')
    logger.success(`Updated .codex/skills/${skill}/SKILL.md`)
    updated++
  }

  return { updated, skipped }
}

/** ygg 작업공간 생성: change index, version, gitignore */
async function scaffoldYggWorkspace(projectRoot: string): Promise<void> {
  await mkdir(join(projectRoot, 'ygg', 'change', 'archive'), { recursive: true })

  const changeIndexPath = join(projectRoot, 'ygg', 'change', 'INDEX.md')
  if (!await fileExists(changeIndexPath)) {
    await writeFile(changeIndexPath, '# Change Index\n\n| 토픽 | 상태 | 단계 | YGG Point | 설명 | 마지막 날짜 |\n|------|------|------|-----------|------|------------|\n\n### Archive\n\n| 토픽 | 설명 |\n|------|------|\n', 'utf-8')
    logger.success('Created ygg/change/INDEX.md')
  }

  const version = getPackageVersion()
  const yggVersionPath = join(projectRoot, 'ygg', '.ygg-version')
  if (!await fileExists(yggVersionPath)) {
    await writeFile(yggVersionPath, version + '\n', 'utf-8')
    logger.success('Created ygg/.ygg-version')
  }

  await appendGitignore(projectRoot, '.ygg-changed')
}

/** 파일이 없을 때만 복사 */
async function copyIfNotExists(src: string, dest: string, label: string): Promise<void> {
  if (await fileExists(dest)) {
    logger.warn(`${label} already exists. Skipping.`)
    return
  }

  if (await fileExists(src)) {
    await copyFile(src, dest)
    logger.success(`Created ${label}`)
  } else {
    logger.warn(`Template not found for ${label}`)
  }
}


/** settings.json에 기본 hooks 병합 */
async function mergeSettingsJson(projectRoot: string): Promise<void> {
  const settingsPath = join(projectRoot, '.claude', 'settings.json')
  const templatePath = join(INIT_TEMPLATES_DIR, 'settings.json')

  if (!await fileExists(templatePath)) {
    logger.warn('Hook template not found. Skipping settings.json.')
    return
  }

  const templateContent = await readFile(templatePath, 'utf-8')
  const templateSettings = JSON.parse(templateContent) as Record<string, unknown>

  if (await fileExists(settingsPath)) {
    // 기존 settings.json이 있으면 hooks만 병합
    try {
      const existingContent = await readFile(settingsPath, 'utf-8')
      const existingSettings = JSON.parse(existingContent) as Record<string, unknown>

      // hooks 키가 없으면 추가
      if (!existingSettings['hooks']) {
        existingSettings['hooks'] = templateSettings['hooks']
        await writeFile(settingsPath, JSON.stringify(existingSettings, null, 2) + '\n', 'utf-8')
        logger.success('Merged hooks into existing .claude/settings.json')
      } else {
        logger.warn('.claude/settings.json already has hooks. Skipping merge.')
      }
    } catch {
      logger.warn('Failed to parse existing settings.json. Skipping merge.')
    }
  } else {
    // settings.json이 없으면 새로 생성
    await mkdir(dirname(settingsPath), { recursive: true })
    await writeFile(settingsPath, JSON.stringify(templateSettings, null, 2) + '\n', 'utf-8')
    logger.success('Created .claude/settings.json')
  }
}

/** .gitignore에 항목 추가 (이미 있으면 건너뜀) */
async function appendGitignore(projectRoot: string, entry: string): Promise<void> {
  const gitignorePath = join(projectRoot, '.gitignore')

  if (await fileExists(gitignorePath)) {
    const content = await readFile(gitignorePath, 'utf-8')
    if (content.includes(entry)) {
      return // 이미 있음
    }
    await writeFile(gitignorePath, content.trimEnd() + '\n' + entry + '\n', 'utf-8')
  } else {
    await writeFile(gitignorePath, entry + '\n', 'utf-8')
  }
}
