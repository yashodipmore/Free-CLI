/**
 * @free-cli/cli — History Command
 *
 * Manage conversation history from the command line.
 * Subcommands: list (default), show <id>, clear
 */

import chalk from 'chalk';
import boxen from 'boxen';
import {
  listSessions,
  getSession,
  getSessionMessages,
  deleteSession,
  clearAllSessions,
  getSessionCount,
} from '../storage/sessions.js';
import { confirm } from '@inquirer/prompts';

/**
 * Main history command handler.
 */
export async function historyCommand(
  action: string | undefined,
  args: string[],
): Promise<void> {
  switch (action) {
    case 'show':
    case 'view': {
      const sessionId = args[0];
      if (!sessionId) {
        console.error(chalk.red('Usage: fcli history show <session-id>'));
        return;
      }
      await showSession(sessionId);
      return;
    }

    case 'clear': {
      await clearHistory();
      return;
    }

    case 'delete':
    case 'rm': {
      const sid = args[0];
      if (!sid) {
        console.error(chalk.red('Usage: fcli history delete <session-id>'));
        return;
      }
      deleteSession(sid);
      console.error(chalk.green(`✓ Session ${sid.slice(0, 8)} deleted.`));
      return;
    }

    case 'list':
    default:
      await listHistory();
      return;
  }
}

/**
 * List recent sessions.
 */
async function listHistory(): Promise<void> {
  const count = getSessionCount();
  const sessions = listSessions(20);

  if (sessions.length === 0) {
    console.error(chalk.gray('No session history yet. Start chatting with: fcli'));
    return;
  }

  console.error('');
  console.error(
    boxen(chalk.bold(`Session History`) + chalk.gray(` (${count} total)`), {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: 'cyan',
      dimBorder: true,
    }),
  );
  console.error('');

  for (const session of sessions) {
    const date = new Date(session.createdAt).toLocaleDateString();
    const time = new Date(session.createdAt).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    const status =
      session.status === 'completed'
        ? chalk.green('✓')
        : session.status === 'error'
          ? chalk.red('✗')
          : chalk.yellow('○');

    console.error(
      `  ${status} ${chalk.gray(session.id.slice(0, 8))} ${chalk.white(session.title)} ${chalk.gray(`— ${date} ${time}`)}`,
    );
  }

  console.error('');
  console.error(chalk.gray('  Resume: fcli --resume <id>'));
  console.error(chalk.gray('  Details: fcli history show <id>'));
  console.error('');
}

/**
 * Show a specific session's messages.
 */
async function showSession(sessionId: string): Promise<void> {
  // Support partial IDs
  const sessions = listSessions(100);
  const match = sessions.find((s) => s.id.startsWith(sessionId));

  if (!match) {
    console.error(chalk.red(`Session "${sessionId}" not found.`));
    return;
  }

  const session = getSession(match.id);
  if (!session) {
    console.error(chalk.red(`Session "${sessionId}" not found.`));
    return;
  }

  const messages = getSessionMessages(match.id);

  console.error('');
  console.error(
    boxen(
      [
        `${chalk.bold(session.title)}`,
        `${chalk.gray('ID:')}     ${session.id}`,
        `${chalk.gray('Model:')}  ${session.config.model}`,
        `${chalk.gray('Date:')}   ${new Date(session.createdAt).toLocaleString()}`,
        `${chalk.gray('Status:')} ${session.status}`,
      ].join('\n'),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderStyle: 'round',
        borderColor: 'cyan',
        dimBorder: true,
      },
    ),
  );

  console.error('');

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    const roleLabel =
      msg.role === 'user'
        ? chalk.green.bold('❯ You')
        : msg.role === 'assistant'
          ? chalk.cyan.bold('⚡ AI')
          : chalk.yellow.bold('🔧 Tool');

    console.error(`  ${roleLabel}`);

    // Truncate very long messages
    const content =
      msg.content.length > 500
        ? msg.content.slice(0, 500) + chalk.gray('\n  ... (truncated)')
        : msg.content;

    for (const line of content.split('\n')) {
      console.error(`    ${line}`);
    }
    console.error('');
  }
}

/**
 * Clear all session history with confirmation.
 */
async function clearHistory(): Promise<void> {
  const count = getSessionCount();

  if (count === 0) {
    console.error(chalk.gray('No sessions to clear.'));
    return;
  }

  const confirmed = await confirm({
    message: `Delete all ${count} sessions? This cannot be undone.`,
    default: false,
  });

  if (confirmed) {
    clearAllSessions();
    console.error(chalk.green(`✓ Cleared ${count} sessions.`));
  } else {
    console.error(chalk.gray('Cancelled.'));
  }
}
