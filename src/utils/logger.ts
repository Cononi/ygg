import chalk from 'chalk'

export type LogLevel = 'verbose' | 'info' | 'warn' | 'error' | 'quiet'

let currentLevel: LogLevel = 'info'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  verbose: 0,
  info: 1,
  warn: 2,
  error: 3,
  quiet: 4,
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel]
}

export const logger = {
  verbose(message: string): void {
    if (shouldLog('verbose')) {
      // eslint-disable-next-line no-console
      console.log(chalk.gray(`  ${message}`))
    }
  },

  info(message: string): void {
    if (shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.log(chalk.blue('ℹ'), message)
    }
  },

  success(message: string): void {
    if (shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.log(chalk.green('✓'), message)
    }
  },

  warn(message: string): void {
    if (shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(chalk.yellow('⚠'), message)
    }
  },

  error(message: string): void {
    if (shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(chalk.red('✗'), message)
    }
  },
}
