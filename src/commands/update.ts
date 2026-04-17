import { copyFile, mkdir, chmod, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'

import { readConfigTargets, type SupportedTarget } from '../i18n/config.js'
import { resolveLanguage } from '../i18n/index.js'
import { loadRegistry, saveRegistry } from '../server/registry.js'
import { fileExists } from '../utils/file-writer.js'
import { logger } from '../utils/logger.js'
import { getPackageVersion } from '../utils/package-version.js'

import {
  AGENT_DOC_FILENAMES,
  CODEX_SKILLS,
  INIT_TEMPLATES_DIR,
  YGG_SCRIPTS_DIR,
  getLangDir,
  listTemplateAgents,
  listTemplateCommands,
  listTemplateScripts,
  listTemplateSkills,
  renderCodexDoc,
  syncCodexSkills,
} from './init.js'

function getAgentDocsDir(lang: string): string {
  return join(getLangDir(lang), 'agent-docs')
}

/**
 * commands + skills + agents를 언어별 템플릿 디렉토리에서 복사한다.
 * lang 커맨드에서 즉시 적용 시, runUpdate 내부에서 공통으로 사용.
 */
export async function copyI18nFiles(
  projectRoot: string,
  lang: string,
): Promise<{ updated: number; skipped: number }> {
  const claudeDir = join(projectRoot, '.claude')
  const langDir = getLangDir(lang)
  const commands = await listTemplateCommands(lang)
  const skills = await listTemplateSkills(lang)
  const agents = await listTemplateAgents(lang)
  let updated = 0
  let skipped = 0

  // Commands: 항상 최신으로 덮어쓰기
  for (const cmd of commands) {
    const src = join(langDir, 'commands', 'ygg', `${cmd}.md`)
    const dest = join(claudeDir, 'commands', 'ygg', `${cmd}.md`)
    const result = await copyFromTemplate(src, dest, `.claude/commands/ygg/${cmd}.md`)
    if (result === 'updated') updated++
    else if (result === 'skipped') skipped++
  }

  // Skills: 항상 최신으로 덮어쓰기
  for (const skill of skills) {
    await mkdir(join(claudeDir, 'skills', skill), { recursive: true })
    const src = join(langDir, 'skills', skill, 'SKILL.md')
    const dest = join(claudeDir, 'skills', skill, 'SKILL.md')
    const result = await copyFromTemplate(src, dest, `.claude/skills/${skill}/SKILL.md`)
    if (result === 'updated') updated++
    else if (result === 'skipped') skipped++
  }

  // Agents: 항상 최신으로 덮어쓰기 (신규 추가)
  if (agents.length > 0) {
    await mkdir(join(claudeDir, 'agents'), { recursive: true })
    for (const agentFile of agents) {
      const src = join(langDir, 'agents', agentFile)
      const dest = join(claudeDir, 'agents', agentFile)
      const result = await copyFromTemplate(src, dest, `.claude/agents/${agentFile}`)
      if (result === 'updated') updated++
      else if (result === 'skipped') skipped++
    }
  }

  return { updated, skipped }
}

/** update 커맨드: ygg 관리 파일을 최신 템플릿으로 갱신 + deprecated 파일 제거 */
export async function runUpdate(projectRoot: string): Promise<void> {
  const claudeDir = join(projectRoot, '.claude')
  const yggDir = join(projectRoot, 'ygg')
  const yggScriptsDir = join(projectRoot, YGG_SCRIPTS_DIR)
  const targets = await resolveUpdateTargets(projectRoot)

  if (targets.length === 0 && !await fileExists(yggDir)) {
    throw new Error('No ygg-managed files found. Run `ygg init` first.')
  }

  const lang = await resolveLanguage(projectRoot)
  let removed = 0

  let updated = 0
  let skipped = 0

  removed += await cleanupDeselectedTargets(projectRoot, targets)

  const docsResult = await copyTargetDocs(projectRoot, lang, targets)
  updated += docsResult.updated
  skipped += docsResult.skipped

  if (targets.includes('claude')) {
    const workflowResult = await copyI18nFiles(projectRoot, lang)
    updated += workflowResult.updated
    skipped += workflowResult.skipped

    const scripts = await listTemplateScripts()
    for (const script of scripts) {
      const src = join(INIT_TEMPLATES_DIR, 'scripts', script)
      const dest = join(yggScriptsDir, script)
      const result = await copyFromTemplate(src, dest, `${YGG_SCRIPTS_DIR}/${script}`)
      if (result === 'updated') updated++
      else if (result === 'skipped') skipped++
      if (await fileExists(dest)) {
        await chmod(dest, 0o755)
      }
    }

    removed += await cleanupDeprecated(claudeDir, lang)

    await mergeSettingsHooks(projectRoot)
  }

  if (targets.includes('codex')) {
    const codexResult = await syncCodexSkills(projectRoot, lang)
    updated += codexResult.updated
    skipped += codexResult.skipped
    removed += await cleanupCodexDeprecated(projectRoot, lang)
  }

  const version = getPackageVersion()

  // registry yggVersion 갱신
  const registry = await loadRegistry()
  const projectEntry = registry.projects.find(p => p.path === resolve(projectRoot))
  if (projectEntry) {
    projectEntry.yggVersion = version
    await saveRegistry(registry)
  }

  // ygg/change/archive/ 디렉토리 보장
  await mkdir(join(projectRoot, 'ygg', 'change', 'archive'), { recursive: true })

  // ygg/.ygg-version 갱신
  await writeFile(join(projectRoot, 'ygg', '.ygg-version'), version + '\n', 'utf-8')

  const parts = [`${updated} updated`, `${skipped} already up-to-date`]
  if (removed > 0) {
    parts.push(`${removed} deprecated removed`)
  }
  logger.success(`Update complete: ${parts.join(', ')}`)
}

/** deprecated된 ygg commands, skills, scripts를 감지하고 제거한다 */
async function cleanupDeprecated(claudeDir: string, lang: string): Promise<number> {
  let removed = 0
  const commands = await listTemplateCommands(lang)
  const skills = await listTemplateSkills(lang)
  const scripts = await listTemplateScripts()
  const agents = await listTemplateAgents(lang)

  // ygg commands: templates에 정의된 목록과 실제 파일을 비교
  const commandsDir = join(claudeDir, 'commands', 'ygg')
  removed += await removeStaleFiles(
    commandsDir,
    new Set(commands.map((c) => `${c}.md`)),
    '.claude/commands/ygg',
  )

  // ygg skills: templates에 정의된 목록과 실제 디렉토리를 비교
  const skillsDir = join(claudeDir, 'skills')
  removed += await removeStaleDirectories(
    skillsDir,
    new Set(skills),
    'ygg-',
    '.claude/skills',
  )

  // hook scripts: templates에 정의된 목록과 실제 파일을 비교
  const scriptsDir = join(resolve(claudeDir, '..'), YGG_SCRIPTS_DIR)
  removed += await removeStaleFiles(
    scriptsDir,
    new Set(scripts),
    YGG_SCRIPTS_DIR,
    'ygg-',
  )

  // agents: templates에 정의된 목록과 실제 파일을 비교
  const agentsDir = join(claudeDir, 'agents')
  removed += await removeStaleFiles(
    agentsDir,
    new Set(agents),
    '.claude/agents',
  )

  return removed
}

/** 디렉토리 내에서 허용 목록에 없는 파일을 제거한다 */
async function removeStaleFiles(
  dir: string,
  allowedFiles: Set<string>,
  label: string,
  prefix?: string,
): Promise<number> {
  if (!await fileExists(dir)) return 0

  let removed = 0
  const entries = await readdir(dir)

  for (const entry of entries) {
    // prefix가 지정되면 해당 prefix로 시작하는 파일만 대상
    if (prefix && !entry.startsWith(prefix)) continue

    if (!allowedFiles.has(entry)) {
      const filePath = join(dir, entry)
      await rm(filePath, { force: true })
      logger.warn(`Removed deprecated ${label}/${entry}`)
      removed++
    }
  }

  return removed
}

/** 디렉토리 내에서 허용 목록에 없는 하위 디렉토리를 제거한다 */
async function removeStaleDirectories(
  dir: string,
  allowedDirs: Set<string>,
  prefix: string,
  label: string,
): Promise<number> {
  if (!await fileExists(dir)) return 0

  let removed = 0
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (!entry.name.startsWith(prefix)) continue

    if (!allowedDirs.has(entry.name)) {
      const dirPath = join(dir, entry.name)
      await rm(dirPath, { recursive: true, force: true })
      logger.warn(`Removed deprecated ${label}/${entry.name}/`)
      removed++
    }
  }

  return removed
}

/** 템플릿에서 복사. 내용이 같으면 skip, 다르면 덮어쓰기 */
async function copyFromTemplate(
  src: string,
  dest: string,
  label: string,
): Promise<'updated' | 'skipped' | 'missing'> {
  if (!await fileExists(src)) {
    logger.warn(`Template not found for ${label}`)
    return 'missing'
  }

  if (await fileExists(dest)) {
    const srcContent = await readFile(src, 'utf-8')
    const destContent = await readFile(dest, 'utf-8')
    if (srcContent === destContent) {
      return 'skipped'
    }
  }

  await mkdir(dirname(dest), { recursive: true })
  await copyFile(src, dest)
  logger.success(`Updated ${label}`)
  return 'updated'
}


/** settings.json hooks를 최신 템플릿으로 덮어쓰기 (다른 키는 보존) */
async function mergeSettingsHooks(projectRoot: string): Promise<void> {
  const settingsPath = join(projectRoot, '.claude', 'settings.json')
  const templatePath = join(INIT_TEMPLATES_DIR, 'settings.json')

  if (!await fileExists(templatePath)) {
    logger.warn('Hook template not found. Skipping settings.json.')
    return
  }

  const templateContent = await readFile(templatePath, 'utf-8')
  const templateSettings = JSON.parse(templateContent) as Record<string, unknown>

  if (await fileExists(settingsPath)) {
    try {
      const existingContent = await readFile(settingsPath, 'utf-8')
      const existingSettings = JSON.parse(existingContent) as Record<string, unknown>
      existingSettings['hooks'] = templateSettings['hooks']
      await writeFile(settingsPath, JSON.stringify(existingSettings, null, 2) + '\n', 'utf-8')
      logger.success('Updated hooks in .claude/settings.json')
    } catch {
      logger.warn('Failed to parse existing settings.json. Skipping.')
    }
  } else {
    await mkdir(dirname(settingsPath), { recursive: true })
    await writeFile(settingsPath, JSON.stringify(templateSettings, null, 2) + '\n', 'utf-8')
    logger.success('Created .claude/settings.json')
  }
}

async function resolveUpdateTargets(projectRoot: string): Promise<SupportedTarget[]> {
  const configured = await readConfigTargets(projectRoot)
  if (configured && configured.length > 0) {
    return configured
  }

  const inferred: SupportedTarget[] = []
  if (await fileExists(join(projectRoot, '.claude'))) {
    inferred.push('claude')
  }
  if (await fileExists(join(projectRoot, AGENT_DOC_FILENAMES.codex))) {
    inferred.push('codex')
  }
  if (await fileExists(join(projectRoot, AGENT_DOC_FILENAMES.claude)) && !inferred.includes('claude')) {
    inferred.push('claude')
  }
  return inferred
}

async function copyTargetDocs(
  projectRoot: string,
  lang: string,
  targets: SupportedTarget[],
): Promise<{ updated: number; skipped: number }> {
  const agentDocsDir = getAgentDocsDir(lang)
  let updated = 0
  let skipped = 0

  const sharedDoc = await copyFromTemplate(
    join(agentDocsDir, 'shared.md'),
    join(projectRoot, 'ygg', AGENT_DOC_FILENAMES.shared),
    `ygg/${AGENT_DOC_FILENAMES.shared}`,
  )
  if (sharedDoc === 'updated') updated++
  else if (sharedDoc === 'skipped') skipped++

  if (targets.includes('claude')) {
    const claudeDoc = await copyFromTemplate(
      join(agentDocsDir, 'CLAUDE.md'),
      join(projectRoot, AGENT_DOC_FILENAMES.claude),
      AGENT_DOC_FILENAMES.claude,
    )
    if (claudeDoc === 'updated') updated++
    else if (claudeDoc === 'skipped') skipped++
  }

  if (targets.includes('codex')) {
    const codexDoc = await writeRenderedCodexDoc(join(projectRoot, AGENT_DOC_FILENAMES.codex), lang)
    if (codexDoc === 'updated') updated++
    else if (codexDoc === 'skipped') skipped++
  }

  return { updated, skipped }
}

async function cleanupDeselectedTargets(
  projectRoot: string,
  targets: SupportedTarget[],
): Promise<number> {
  let removed = 0

  if (!targets.includes('claude')) {
    const claudeDocPath = join(projectRoot, AGENT_DOC_FILENAMES.claude)
    if (await fileExists(claudeDocPath)) {
      await rm(claudeDocPath, { force: true })
      logger.warn(`Removed deselected target file ${AGENT_DOC_FILENAMES.claude}`)
      removed++
    }

    const claudeDir = join(projectRoot, '.claude')
    if (await fileExists(claudeDir)) {
      await rm(claudeDir, { recursive: true, force: true })
      logger.warn('Removed deselected target directory .claude/')
      removed++
    }
  }

  if (!targets.includes('codex')) {
    const codexDocPath = join(projectRoot, AGENT_DOC_FILENAMES.codex)
    if (await fileExists(codexDocPath)) {
      await rm(codexDocPath, { force: true })
      logger.warn(`Removed deselected target file ${AGENT_DOC_FILENAMES.codex}`)
      removed++
    }

    const codexDir = join(projectRoot, '.codex')
    if (await fileExists(codexDir)) {
      await rm(codexDir, { recursive: true, force: true })
      logger.warn('Removed deselected target directory .codex/')
      removed++
    }
  }

  return removed
}

async function cleanupCodexDeprecated(projectRoot: string, lang: string): Promise<number> {
  const codexSkillsDir = join(projectRoot, '.codex', 'skills')
  const skills = await listTemplateSkills(lang)
  const codexSkills = skills.filter((skill) => CODEX_SKILLS.includes(skill))

  return removeStaleDirectories(
    codexSkillsDir,
    new Set(codexSkills),
    'ygg-',
    '.codex/skills',
  )
}

async function writeRenderedCodexDoc(
  dest: string,
  lang: string,
): Promise<'updated' | 'skipped'> {
  const content = await renderCodexDoc(lang)

  if (await fileExists(dest)) {
    const existing = await readFile(dest, 'utf-8')
    if (existing === content) {
      return 'skipped'
    }
  }

  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, content, 'utf-8')
  logger.success(`Updated ${AGENT_DOC_FILENAMES.codex}`)
  return 'updated'
}
