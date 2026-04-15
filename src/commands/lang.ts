import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { readConfigTargets, writeConfigLang } from '../i18n/config.js'
import { SUPPORTED_LANGS } from '../i18n/index.js'
import { fileExists } from '../utils/file-writer.js'
import { logger } from '../utils/logger.js'

import { AGENT_DOC_FILENAMES, getLangDir, renderCodexDoc, syncCodexSkills } from './init.js'
import { copyI18nFiles } from './update.js'

const LANG_LABELS: Record<string, string> = {
  ko: 'Korean',
  en: 'English',
}

/** lang 커맨드: 화살표 키 언어 선택 후 ygg/config.yml에 저장, 초기화된 프로젝트면 즉시 재렌더링 */
export async function runLang(projectRoot: string): Promise<void> {
  if (!process.stdin.isTTY) {
    logger.error('ygg lang requires an interactive terminal (stdin is not a TTY)')
    process.exitCode = 1
    return
  }

  const selected = await promptLangSelection()
  if (!selected) {
    process.exitCode = 1
    return
  }

  await writeConfigLang(projectRoot, selected)
  logger.success(`Language set to: ${selected}`)

  let updated = 0
  let skipped = 0
  const targets = await readConfigTargets(projectRoot) ?? []
  const claudeDir = join(projectRoot, '.claude')
  if (targets.includes('claude') || await fileExists(claudeDir)) {
    const result = await copyI18nFiles(projectRoot, selected)
    updated += result.updated
    skipped += result.skipped
  }

  const codexDir = join(projectRoot, '.codex')
  if (targets.includes('codex') || await fileExists(codexDir)) {
    const result = await syncCodexSkills(projectRoot, selected)
    updated += result.updated
    skipped += result.skipped
  }

  const docsResult = await copyTargetDocs(projectRoot, selected, targets)
  updated += docsResult.updated
  skipped += docsResult.skipped

  if (updated + skipped > 0) {
    logger.success(`Rendered ${updated + skipped} files (${updated} updated, ${skipped} already up-to-date)`)
  } else {
    logger.info('Run `ygg init` or `ygg update` to apply')
  }
}

async function promptLangSelection(): Promise<string | null> {
  const options = SUPPORTED_LANGS.map((lang) => ({
    value: lang,
    label: `${lang} (${LANG_LABELS[lang] ?? lang})`,
  }))

  logger.info('언어를 선택하세요 (↑↓ 이동, Enter 선택, Ctrl+C 취소):')
  const selected = await arrowKeySelect(options)

  if (!selected) {
    logger.error('Selection cancelled.')
    return null
  }

  return selected
}

async function copyTargetDocs(
  projectRoot: string,
  lang: string,
  targets: string[],
): Promise<{ updated: number; skipped: number }> {
  const docsDir = join(getLangDir(lang), 'agent-docs')
  let updated = 0
  let skipped = 0

  const shared = await copyDoc(join(docsDir, 'shared.md'), join(projectRoot, 'ygg', AGENT_DOC_FILENAMES.shared))
  if (shared === 'updated') updated++
  else if (shared === 'skipped') skipped++

  if (targets.includes('claude')) {
    const claude = await copyDoc(join(docsDir, 'CLAUDE.md'), join(projectRoot, AGENT_DOC_FILENAMES.claude))
    if (claude === 'updated') updated++
    else if (claude === 'skipped') skipped++
  }

  if (targets.includes('codex')) {
    const codex = await renderCodex(lang, join(projectRoot, AGENT_DOC_FILENAMES.codex))
    if (codex === 'updated') updated++
    else if (codex === 'skipped') skipped++
  }

  return { updated, skipped }
}

async function copyDoc(src: string, dest: string): Promise<'updated' | 'skipped' | 'missing'> {
  const { copyFile } = await import('node:fs/promises')
  const { dirname } = await import('node:path')

  if (!await fileExists(src)) return 'missing'

  if (await fileExists(dest)) {
    const [srcContent, destContent] = await Promise.all([
      readFile(src, 'utf-8'),
      readFile(dest, 'utf-8'),
    ])
    if (srcContent === destContent) return 'skipped'
  }

  await mkdir(dirname(dest), { recursive: true })
  await copyFile(src, dest)
  return 'updated'
}

async function renderCodex(lang: string, dest: string): Promise<'updated' | 'skipped'> {
  const { dirname } = await import('node:path')
  const content = await renderCodexDoc(lang)

  if (await fileExists(dest)) {
    const existing = await readFile(dest, 'utf-8')
    if (existing === content) return 'skipped'
  }

  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, content, 'utf-8')
  return 'updated'
}

/**
 * 화살표 키(↑↓) + Enter로 선택하는 대화형 메뉴.
 * raw stdin 모드를 사용하며 외부 의존성 없음.
 */
async function arrowKeySelect(
  options: Array<{ value: string; label: string }>,
): Promise<string | null> {
  if (options.length === 0) return null

  let index = 0

  const renderMenu = () => {
    // 이전 출력 지우기 (options.length줄 위로)
    if (index >= 0) {
      process.stdout.write(`\x1B[${options.length}A\x1B[0J`)
    }
    for (let i = 0; i < options.length; i++) {
      const marker = i === index ? '▶' : ' '
      process.stdout.write(`  ${marker} ${options[i].label}\n`)
    }
  }

  // 초기 렌더링
  for (const opt of options) {
    process.stdout.write(`    ${opt.label}\n`)
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

      // Ctrl+C (0x03) 또는 q (0x71)
      if (b0 === 0x03 || b0 === 0x71) {
        cleanup()
        resolve(null)
        return
      }

      // Enter (0x0D 또는 0x0A)
      if (b0 === 0x0D || b0 === 0x0A) {
        cleanup()
        resolve(options[index].value)
        return
      }

      // ESC [ A (↑ 위쪽)
      if (b0 === 0x1B && b1 === 0x5B && b2 === 0x41) {
        index = (index - 1 + options.length) % options.length
        renderMenu()
        return
      }

      // ESC [ B (↓ 아래쪽)
      if (b0 === 0x1B && b1 === 0x5B && b2 === 0x42) {
        index = (index + 1) % options.length
        renderMenu()
        return
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
