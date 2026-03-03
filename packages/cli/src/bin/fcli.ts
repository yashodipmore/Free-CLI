/**
 * @free-cli/cli — Main Entry Point
 *
 * #!/usr/bin/env node
 *
 * This is the file that runs when anyone types `fcli` or `npx free-cli`.
 * It must be fast to start — only import what's needed at the top level.
 *
 * Flow:
 *   1. Parse arguments with Commander.js
 *   2. If first run → launch setup wizard
 *   3. Route to the correct command handler
 *   4. Handle errors gracefully
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION, CLI_NAME, APP_NAME } from '@free-cli/core';
import { ensureDirectories, isFirstRun, markFirstRunComplete } from '../storage/config.js';
import { logger } from '../utils/logger.js';
import { FreeCLIError } from '../utils/errors.js';

/**
 * Build and return the Commander program.
 * Separated from execution for testability.
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description(`${APP_NAME} — Enterprise-Grade AI Terminal Agent powered by Groq LPU`)
    .version(VERSION, '-v, --version', 'Show version number')
    .option('--verbose', 'Enable verbose debug logging', false)
    .option('--model <model>', 'Override the default model for this session')
    .argument('[prompt...]', 'One-shot prompt (runs and exits)')
    .action(async (promptParts: string[], options: { model?: string; verbose?: boolean }) => {
      // If prompt parts were given, combine them into one prompt string
      const prompt = promptParts.length > 0 ? promptParts.join(' ') : undefined;

      // Lazy import to keep startup fast
      const { chatCommand } = await import('../commands/chat.js');
      await chatCommand(prompt, options);
    });

  // Config command
  program
    .command('config [action] [args...]')
    .description('Manage configuration (set/get/reset)')
    .action(async (action: string | undefined, args: string[]) => {
      const { configCommand } = await import('../commands/config.js');
      await configCommand(action, args);
    });

  // Doctor command (placeholder for Phase 2)
  program
    .command('doctor')
    .description('Diagnose environment and configuration')
    .action(async () => {
      const { doctorCommand } = await import('../commands/doctor.js');
      await doctorCommand();
    });

  return program;
}

/**
 * Main entry point — called when `fcli` runs.
 */
async function main(): Promise<void> {
  // Ensure config directories exist
  ensureDirectories();

  // Handle verbose flag early for debugging startup
  if (process.argv.includes('--verbose')) {
    logger.setLevel('debug');
    logger.debug('Verbose logging enabled');
  }

  // First run detection — show setup wizard
  const isFirstRunCommand =
    process.argv.length <= 2 || // Just `fcli` with no args
    process.argv[2] === 'config'; // `fcli config`

  if (isFirstRun() && isFirstRunCommand) {
    logger.debug('First run detected — launching setup wizard');
    const { configWizard } = await import('../commands/config.js');
    await configWizard();
    markFirstRunComplete();

    // After wizard, if no other command was given, start chat
    if (process.argv.length <= 2) {
      const { chatCommand } = await import('../commands/chat.js');
      await chatCommand(undefined, {});
      return;
    }
  }

  // Parse and execute
  const program = createProgram();
  await program.parseAsync(process.argv);
}

// ── Execute ────────────────────────────────────────────────────────

main().catch((error: unknown) => {
  if (error instanceof FreeCLIError) {
    console.error(chalk.red(`\nError [${error.code}]: ${error.message}`));
    if (error.cause) {
      logger.debug(`Caused by: ${error.cause.message}`);
    }
    process.exit(1);
  }

  if (error instanceof Error) {
    // Commander exits with code 0 for --help/--version
    if (error.message.includes('commander')) {
      process.exit(0);
    }
    console.error(chalk.red(`\nUnexpected error: ${error.message}`));
    logger.debug(`Stack: ${error.stack}`);
    process.exit(1);
  }

  console.error(chalk.red('\nAn unexpected error occurred.'));
  process.exit(1);
});
