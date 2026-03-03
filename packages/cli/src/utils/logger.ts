/**
 * @free-cli/cli — Logger
 *
 * Structured logging utility with color-coded levels.
 * Uses chalk for terminal colors in all output.
 */

import chalk from 'chalk';

/** Log levels in order of severity */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Current log level — only messages at this level or higher are shown */
let currentLevel: LogLevel = 'info';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: chalk.gray('[DEBUG]'),
  info: chalk.blue('[INFO]'),
  warn: chalk.yellow('[WARN]'),
  error: chalk.red('[ERROR]'),
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = chalk.gray(new Date().toISOString().slice(11, 23));
  const label = LEVEL_LABELS[level];
  const formattedArgs = args.length > 0 ? ' ' + args.map(String).join(' ') : '';
  return `${timestamp} ${label} ${message}${formattedArgs}`;
}

export const logger = {
  /** Set the minimum log level */
  setLevel(level: LogLevel): void {
    currentLevel = level;
  },

  /** Get the current log level */
  getLevel(): LogLevel {
    return currentLevel;
  },

  /** Debug message — only shown with --verbose */
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.error(formatMessage('debug', message, ...args));
    }
  },

  /** Informational message */
  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.error(formatMessage('info', message, ...args));
    }
  },

  /** Warning message */
  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, ...args));
    }
  },

  /** Error message */
  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, ...args));
    }
  },

  /** Print a blank line (for formatting) */
  blank(): void {
    console.error('');
  },
};
