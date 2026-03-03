/**
 * @free-cli/cli — Chat Command
 *
 * Interactive chat mode or one-shot prompt execution.
 * This is the primary command when users run `fcli` or `fcli "prompt"`.
 */

import chalk from 'chalk';
import ora from 'ora';
import { input } from '@inquirer/prompts';
import { generateId, now } from '@free-cli/core';
import type { ConversationMessage, LLMStreamChunk } from '@free-cli/core';
import { GroqProvider } from '../llm/groq.js';
import { getConfig, getApiKey } from '../storage/config.js';
import { logger } from '../utils/logger.js';
import { AuthenticationError } from '../utils/errors.js';

/** ANSI escape to clear the current line */
const CLEAR_LINE = '\x1B[2K\r';

/**
 * Run the chat command — either interactive REPL or one-shot mode.
 *
 * @param prompt - If provided, runs in one-shot mode and exits.
 *                 If empty, starts the interactive REPL loop.
 * @param options - Command options (model, verbose, etc.)
 */
export async function chatCommand(
  prompt: string | undefined,
  options: { model?: string; verbose?: boolean },
): Promise<void> {
  // Check for API key
  const apiKey = await getApiKey('groq');
  if (!apiKey) {
    throw new AuthenticationError(
      'groq',
      `${chalk.red('✗')} No Groq API key found.\n\n` +
        `  Get a free key at: ${chalk.cyan('https://console.groq.com')}\n` +
        `  Then run: ${chalk.yellow('fcli config')} to set it up.\n` +
        `  Or set the ${chalk.yellow('GROQ_API_KEY')} environment variable.\n`,
    );
  }

  const model = options.model || getConfig('defaultModel');
  const provider = new GroqProvider();

  if (options.verbose) {
    logger.setLevel('debug');
  }

  // One-shot mode
  if (prompt) {
    await executeOneShot(provider, model, prompt);
    return;
  }

  // Interactive REPL mode
  await interactiveREPL(provider, model);
}

/**
 * Execute a single prompt and stream the response.
 */
async function executeOneShot(
  provider: GroqProvider,
  model: string,
  prompt: string,
): Promise<void> {
  const messages: ConversationMessage[] = [
    {
      id: generateId(),
      role: 'system',
      content: buildSystemPrompt(),
      timestamp: now(),
    },
    {
      id: generateId(),
      role: 'user',
      content: prompt,
      timestamp: now(),
    },
  ];

  await streamResponse(provider, model, messages);
}

/**
 * Run the interactive REPL loop.
 */
async function interactiveREPL(provider: GroqProvider, model: string): Promise<void> {
  // Print welcome header
  printWelcome(model);

  const messages: ConversationMessage[] = [
    {
      id: generateId(),
      role: 'system',
      content: buildSystemPrompt(),
      timestamp: now(),
    },
  ];

  // REPL loop
  while (true) {
    let userInput: string;

    try {
      userInput = await input({
        message: chalk.green('❯'),
        theme: {
          prefix: '',
          style: {
            message: (text: string) => chalk.green(text),
          },
        },
      });
    } catch {
      // User pressed Ctrl+C or Ctrl+D
      console.error(chalk.gray('\n👋 Goodbye!'));
      break;
    }

    const trimmed = userInput.trim();
    if (!trimmed) continue;

    // Handle slash commands
    if (trimmed.startsWith('/')) {
      const handled = handleSlashCommand(trimmed, messages, model);
      if (handled === 'exit') break;
      if (handled === 'handled') continue;
    }

    // Add user message
    messages.push({
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: now(),
    });

    // Stream AI response
    const response = await streamResponse(provider, model, messages);

    // Add assistant response to history
    if (response) {
      messages.push({
        id: generateId(),
        role: 'assistant',
        content: response,
        timestamp: now(),
      });
    }

    console.error(''); // Blank line between turns
  }
}

/**
 * Stream a response from the LLM and print it to the terminal.
 * Returns the full response text.
 */
async function streamResponse(
  provider: GroqProvider,
  model: string,
  messages: ConversationMessage[],
): Promise<string | null> {
  const spinner = ora({
    text: chalk.gray('Thinking...'),
    spinner: 'dots',
    stream: process.stderr,
  }).start();

  let fullContent = '';
  let firstToken = true;

  try {
    const stream = provider.chatStream({
      model,
      messages,
      stream: true,
      temperature: 0.7,
    });

    for await (const chunk of stream as AsyncIterable<LLMStreamChunk>) {
      if (firstToken && chunk.content) {
        spinner.stop();
        process.stderr.write(CLEAR_LINE);
        firstToken = false;
      }

      if (chunk.content) {
        fullContent += chunk.content;
        process.stdout.write(chunk.content);
      }

      // Log usage on final chunk
      if (chunk.done && chunk.usage) {
        logger.debug(
          `Tokens — prompt: ${chunk.usage.promptTokens}, completion: ${chunk.usage.completionTokens}, total: ${chunk.usage.totalTokens}`,
        );
      }
    }

    if (firstToken) {
      // No content tokens were received
      spinner.stop();
    }

    // Ensure newline after streaming
    if (fullContent && !fullContent.endsWith('\n')) {
      process.stdout.write('\n');
    }

    return fullContent || null;
  } catch (error) {
    spinner.fail(chalk.red('Error'));

    if (error instanceof Error) {
      console.error(chalk.red(`\n  ${error.message}`));
      logger.debug(`Full error: ${error.stack}`);
    }

    return null;
  }
}

/**
 * Handle slash commands inside the REPL.
 * Returns 'exit' to quit, 'handled' if the command was processed, or 'unhandled'.
 */
function handleSlashCommand(
  command: string,
  messages: ConversationMessage[],
  model: string,
): 'exit' | 'handled' | 'unhandled' {
  const parts = command.split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  switch (cmd) {
    case '/exit':
    case '/quit':
      console.error(chalk.gray('👋 Goodbye!'));
      return 'exit';

    case '/clear':
      // Keep only the system message
      messages.length = 1;
      console.error(chalk.gray('🧹 Conversation cleared.'));
      return 'handled';

    case '/model':
      console.error(chalk.gray(`Current model: ${chalk.cyan(model)}`));
      return 'handled';

    case '/tools':
      console.error(chalk.gray('🔧 Tools will be available in Phase 2.'));
      return 'handled';

    case '/help':
      printSlashHelp();
      return 'handled';

    default:
      console.error(chalk.yellow(`Unknown command: ${cmd}. Type /help for available commands.`));
      return 'handled';
  }
}

/**
 * Build the system prompt with current environment context.
 */
function buildSystemPrompt(): string {
  const cwd = process.cwd();
  const nodeVersion = process.version;
  const platform = process.platform;
  const date = new Date().toISOString().split('T')[0];

  return `You are Free-CLI (fcli), an AI coding assistant running in the user's terminal.
You are powered by Groq's LPU inference engine for blazing-fast responses.

## Current Environment
- Working Directory: ${cwd}
- Platform: ${platform}
- Node.js: ${nodeVersion}
- Date: ${date}

## Guidelines
- Be concise and direct — this is a terminal, not a chat app
- When showing code, use markdown code blocks with language identifiers
- If you need to explain something, use bullet points
- For file edits, show the exact changes needed
- If asked about your capabilities, mention you can help with coding, debugging, file operations, and general knowledge
- You are in Phase 0 — basic chat only. Tool calling (file read/write, shell, git, etc.) will be available in later phases.

Be helpful, accurate, and fast.`;
}

/**
 * Print the welcome banner.
 */
function printWelcome(model: string): void {
  console.error('');
  console.error(chalk.bold.cyan('  ⚡ Free-CLI') + chalk.gray(' — Your terminal. Your AI. Groq fast.'));
  console.error(chalk.gray(`  Model: ${model}`));
  console.error(chalk.gray('  Type /help for commands, /exit to quit.'));
  console.error('');
}

/**
 * Print slash command help.
 */
function printSlashHelp(): void {
  console.error('');
  console.error(chalk.bold('  Available Commands:'));
  console.error(chalk.gray('  /clear     ') + 'Clear conversation context');
  console.error(chalk.gray('  /model     ') + 'Show current model');
  console.error(chalk.gray('  /tools     ') + 'List available tools');
  console.error(chalk.gray('  /help      ') + 'Show this help message');
  console.error(chalk.gray('  /exit      ') + 'Exit the chat');
  console.error('');
}
