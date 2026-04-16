import * as readline from 'node:readline'

export interface SelectOption {
  readonly value: string
  readonly label: string
}

export type AskQuestion = (question: string) => Promise<string | null>
export type SelectOptionFn = (
  prompt: string,
  options: readonly SelectOption[],
) => Promise<string | null>

export async function promptInput(question: string): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim() || null)
    })
    rl.on('close', () => resolve(null))
  })
}

export async function arrowKeySelect(options: readonly SelectOption[]): Promise<string | null> {
  if (options.length === 0) return null

  let index = 0

  const renderMenu = () => {
    process.stdout.write(`\x1B[${options.length}A\x1B[0J`)
    for (let i = 0; i < options.length; i++) {
      const marker = i === index ? '▶' : ' '
      const option = options[i]
      if (option) process.stdout.write(`  ${marker} ${option.label}\n`)
    }
  }

  for (const option of options) {
    process.stdout.write(`    ${option.label}\n`)
  }
  renderMenu()

  return new Promise((resolve) => {
    const stdin = process.stdin
    stdin.setRawMode?.(true)
    stdin.resume()

    const onData = (buf: Buffer) => {
      const b0 = buf[0]
      const b1 = buf[1]
      const b2 = buf[2]

      if (b0 === 0x03 || b0 === 0x71) {
        cleanup()
        resolve(null)
        return
      }

      if (b0 === 0x0D || b0 === 0x0A) {
        cleanup()
        resolve(options[index]?.value ?? null)
        return
      }

      if (b0 >= 0x31 && b0 <= 0x39) {
        const numericIndex = b0 - 0x31
        if (numericIndex < options.length) {
          cleanup()
          resolve(options[numericIndex]?.value ?? null)
          return
        }
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
      stdin.setRawMode?.(false)
      stdin.pause()
    }

    stdin.on('data', onData)
  })
}

export async function selectOption(
  prompt: string,
  options: readonly SelectOption[],
  askQuestion: AskQuestion = promptInput,
  customSelect?: SelectOptionFn,
): Promise<string | null> {
  if (customSelect) {
    return customSelect(prompt, options)
  }

  if (process.stdin.isTTY && process.stdout.isTTY) {
    process.stdout.write(`${prompt}\n`)
    return arrowKeySelect(options)
  }

  const menuText = [
    prompt,
    ...options.map((option, index) => `${index + 1}. ${option.label}`),
    '번호를 입력하세요: ',
  ].join('\n')
  const raw = await askQuestion(menuText)
  if (!raw) return null

  const numeric = Number.parseInt(raw, 10)
  if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= options.length) {
    return options[numeric - 1]?.value ?? null
  }

  const matched = options.find((option) => option.value === raw || option.label === raw)
  return matched?.value ?? null
}
