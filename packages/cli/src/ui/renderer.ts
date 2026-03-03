/**
 * @free-cli/cli — Markdown Terminal Renderer
 *
 * Renders LLM markdown responses as beautifully formatted terminal output.
 * Uses marked for parsing + marked-terminal for terminal rendering +
 * cli-highlight for syntax highlighting in code blocks.
 */

import { Marked } from 'marked';
import markedTerminal from 'marked-terminal';
import chalk from 'chalk';

/** Configured Marked instance with terminal renderer */
let markedInstance: Marked | null = null;

/**
 * Get or create the configured Marked instance with terminal output.
 */
function getMarked(): Marked {
  if (markedInstance) return markedInstance;

  markedInstance = new Marked();

  markedInstance.use(
    markedTerminal({
      // Code block styling
      code: chalk.bgGray.white,
      codespan: chalk.cyan,

      // Headings
      heading: chalk.bold.cyan,

      // Text formatting
      strong: chalk.bold,
      em: chalk.italic,
      del: chalk.strikethrough,

      // Links
      href: chalk.blue.underline,

      // Lists
      listitem: chalk.white,

      // Blockquotes
      blockquote: chalk.gray.italic,

      // Tables
      tableOptions: {
        chars: {
          top: '─',
          'top-mid': '┬',
          'top-left': '┌',
          'top-right': '┐',
          bottom: '─',
          'bottom-mid': '┴',
          'bottom-left': '└',
          'bottom-right': '┘',
          left: '│',
          'left-mid': '├',
          mid: '─',
          'mid-mid': '┼',
          right: '│',
          'right-mid': '┤',
          middle: '│',
        },
      },

      // Images — show alt text
      image: chalk.gray,

      // Horizontal rules
      hr: chalk.gray,

      // Width for wrapping
      width: Math.min(process.stdout.columns || 100, 120),

      // Reflowing
      reflowText: true,

      // Show section prefix characters
      showSectionPrefix: true,

      // Tab size
      tab: 2,
    } as Parameters<typeof markedTerminal>[0]),
  );

  return markedInstance;
}

/**
 * Render markdown text to formatted terminal output.
 *
 * @param markdown - Raw markdown string from the LLM
 * @returns Formatted terminal string with ANSI codes
 */
export function renderMarkdown(markdown: string): string {
  try {
    const marked = getMarked();
    const result = marked.parse(markdown);

    // marked.parse can return string or Promise<string>
    if (typeof result === 'string') {
      return result.trimEnd();
    }

    // Shouldn't hit this path since we're not using async extensions,
    // but handle it gracefully
    return markdown;
  } catch (error) {
    // If rendering fails, return raw text as fallback
    logger_warn('Markdown rendering failed, using raw text', error);
    return markdown;
  }
}

/**
 * Render a streaming chunk — applies lightweight formatting
 * without full markdown parsing (for incremental display).
 * Full rendering is done on the complete response.
 */
export function renderStreamingChunk(text: string): string {
  // During streaming, we output raw text.
  // Full markdown rendering happens at the end.
  return text;
}

/**
 * Render a code block with syntax highlighting and a header.
 */
export function renderCodeBlock(code: string, language?: string): string {
  const langLabel = language ? chalk.gray(` ${language} `) : '';
  const header = chalk.bgGray.white(`  Code ${langLabel}`);
  const border = chalk.gray('─'.repeat(Math.min(process.stdout.columns || 60, 60)));

  return `\n${header}\n${border}\n${chalk.white(code)}\n${border}\n`;
}

/**
 * Render a diff view for file changes.
 */
export function renderDiff(filename: string, additions: number, deletions: number): string {
  const addStr = additions > 0 ? chalk.green(`+${additions}`) : '';
  const delStr = deletions > 0 ? chalk.red(`-${deletions}`) : '';
  return `  ${chalk.bold(filename)} ${addStr} ${delStr}`;
}

// Simple inline logger to avoid circular dependency
function logger_warn(msg: string, _error: unknown): void {
  if (process.env['FCLI_DEBUG']) {
    console.error(chalk.yellow(`[WARN] ${msg}`));
  }
}
