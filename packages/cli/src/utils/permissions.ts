/**
 * @free-cli/cli — Permission System
 *
 * Handles permission prompts before tool execution.
 * Three modes: auto (approve all), ask (prompt for destructive), strict (prompt for everything).
 */

import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import type { ToolDefinition, ToolSafetyLevel } from '@free-cli/core';
import { logger } from './logger.js';

/**
 * Check if a tool execution should proceed based on safety level and approval mode.
 *
 * @returns true if the tool should execute, false if denied.
 */
export async function checkPermission(
  tool: ToolDefinition,
  args: Record<string, unknown>,
  approvalMode: 'auto' | 'ask' | 'strict',
): Promise<boolean> {
  // Auto mode — approve everything
  if (approvalMode === 'auto') {
    return true;
  }

  // Strict mode — prompt for everything (even reads)
  if (approvalMode === 'strict') {
    return promptUser(tool, args);
  }

  // Ask mode (default) — prompt only for destructive and safe-write operations
  if (needsApproval(tool.safetyLevel)) {
    return promptUser(tool, args);
  }

  return true;
}

/**
 * Determine if a safety level requires user approval in 'ask' mode.
 */
function needsApproval(level: ToolSafetyLevel): boolean {
  return level === 'destructive' || level === 'safe-write';
}

/**
 * Show a permission prompt to the user.
 */
async function promptUser(
  tool: ToolDefinition,
  args: Record<string, unknown>,
): Promise<boolean> {
  const safetyColor =
    tool.safetyLevel === 'destructive'
      ? chalk.red
      : tool.safetyLevel === 'safe-write'
        ? chalk.yellow
        : chalk.green;

  const safetyLabel = safetyColor(`[${tool.safetyLevel}]`);

  console.error('');
  console.error(chalk.bold(`  🔒 Permission Required ${safetyLabel}`));
  console.error(chalk.gray(`  Tool: `) + chalk.cyan(tool.name));
  console.error(chalk.gray(`  Description: `) + tool.description);

  // Show relevant arguments
  const argSummary = formatArgsSummary(tool.name, args);
  if (argSummary) {
    console.error(chalk.gray(`  Args: `) + argSummary);
  }

  console.error('');

  try {
    const approved = await confirm({
      message: `Allow ${tool.name}?`,
      default: tool.safetyLevel !== 'destructive', // Default yes for safe-write, no for destructive
    });
    return approved;
  } catch {
    // Ctrl+C cancels — deny permission
    logger.debug('Permission prompt cancelled by user');
    return false;
  }
}

/**
 * Format tool arguments into a human-readable summary.
 */
function formatArgsSummary(
  toolName: string,
  args: Record<string, unknown>,
): string {
  // Tool-specific formatting for readability
  switch (toolName) {
    case 'read_file':
      return chalk.white(String(args['path'] ?? ''));
    case 'write_file':
      return `${chalk.white(String(args['path'] ?? ''))} (${String(args['content'] ?? '').length} chars)`;
    case 'edit_file':
      return chalk.white(String(args['path'] ?? ''));
    case 'shell_execute':
      return chalk.yellow(String(args['command'] ?? ''));
    case 'list_directory':
      return chalk.white(String(args['path'] ?? '.'));
    case 'web_search':
      return chalk.white(`"${String(args['query'] ?? '')}"`);
    case 'git_status':
    case 'git_diff':
    case 'git_log':
      return '';
    case 'git_commit':
      return chalk.white(`"${String(args['message'] ?? '')}"`);
    default: {
      // Generic: show first 2 key=value pairs
      const entries = Object.entries(args).slice(0, 2);
      return entries.map(([k, v]) => `${k}=${chalk.white(String(v).slice(0, 60))}`).join(', ');
    }
  }
}
