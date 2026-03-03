/**
 * @free-cli/cli — Chat Command (Phase 1)
 *
 * Interactive chat mode or one-shot prompt execution.
 * Features: markdown rendering, session persistence, enhanced slash commands,
 * gradient welcome banner, and rich terminal output.
 */

import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import gradientString from 'gradient-string';
import { input } from '@inquirer/prompts';
import { generateId, now, formatDuration } from '@free-cli/core';
import type { ConversationMessage, LLMStreamChunk, TokenUsage } from '@free-cli/core';
import { GroqProvider } from '../llm/groq.js';
import { getConfig, getApiKey } from '../storage/config.js';
import {
  createSession,
  addMessage,
  getSessionMessages,
  updateSession,
  autoTitleSession,
  listSessions,
} from '../storage/sessions.js';
import { renderMarkdown as _renderMarkdown } from '../ui/renderer.js';
import { logger } from '../utils/logger.js';
import { AuthenticationError } from '../utils/errors.js';

/** ANSI escape to clear the current line */
const CLEAR_LINE = '\x1B[2K\r';

/** Session-level token accumulator */
interface SessionState {
  sessionId: string;
  model: string;
  tokens: TokenUsage;
  messageCount: number;
  startTime: number;
}

/**
 * Run the chat command — either interactive REPL or one-shot mode.
 */
export async function chatCommand(
  prompt: string | undefined,
  options: { model?: string; verbose?: boolean; resume?: string },
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
  await interactiveREPL(provider, model, options.resume);
}

/**
 * Execute a single prompt and stream the response with markdown rendering.
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

  const result = await streamResponseWithMd(provider, model, messages);

  if (result) {
    logger.debug(`Response length: ${result.content.length} chars`);
  }
}

/**
 * Run the interactive REPL loop with session persistence.
 */
async function interactiveREPL(
  provider: GroqProvider,
  model: string,
  resumeId?: string,
): Promise<void> {
  // Initialize or resume session
  let messages: ConversationMessage[];
  let sessionId: string;

  if (resumeId) {
    const existingMessages = getSessionMessages(resumeId);
    if (existingMessages.length === 0) {
      console.error(chalk.yellow(`Session ${resumeId} not found. Starting new session.`));
      sessionId = initNewSession(model);
      messages = [createSystemMessage()];
    } else {
      sessionId = resumeId;
      messages = existingMessages;
      console.error(chalk.green(`✓ Resumed session ${sessionId.slice(0, 8)} (${existingMessages.length} messages)`));
    }
  } else {
    sessionId = initNewSession(model);
    messages = [createSystemMessage()];
  }

  const state: SessionState = {
    sessionId,
    model,
    tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    messageCount: messages.filter((m) => m.role !== 'system').length,
    startTime: Date.now(),
  };

  // Print welcome header
  printWelcome(state);

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
      await endSession(state);
      break;
    }

    const trimmed = userInput.trim();
    if (!trimmed) continue;

    // Handle slash commands
    if (trimmed.startsWith('/')) {
      const result = await handleSlashCommand(trimmed, messages, state, provider);
      if (result === 'exit') {
        await endSession(state);
        break;
      }
      if (result === 'handled') continue;
    }

    // Add user message
    const userMsg: ConversationMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: now(),
    };
    messages.push(userMsg);
    addMessage(sessionId, userMsg);
    state.messageCount++;

    // Stream AI response
    const result = await streamResponseWithMd(provider, model, messages);

    // Add assistant response to history
    if (result) {
      const assistantMsg: ConversationMessage = {
        id: generateId(),
        role: 'assistant',
        content: result.content,
        timestamp: now(),
      };
      messages.push(assistantMsg);
      addMessage(sessionId, assistantMsg);
      state.messageCount++;

      // Track tokens
      if (result.usage) {
        state.tokens.promptTokens += result.usage.promptTokens;
        state.tokens.completionTokens += result.usage.completionTokens;
        state.tokens.totalTokens += result.usage.totalTokens;
      }

      // Auto-title after first exchange
      if (state.messageCount === 2) {
        autoTitleSession(sessionId, trimmed);
      }
    }

    console.error(''); // Blank line between turns
  }
}

/** Stream response and return content + usage. */
async function streamResponseWithMd(
  provider: GroqProvider,
  model: string,
  messages: ConversationMessage[],
): Promise<{ content: string; usage?: TokenUsage } | null> {
  const spinner = ora({
    text: chalk.gray('Thinking...'),
    spinner: 'dots',
    stream: process.stderr,
  }).start();

  let fullContent = '';
  let firstToken = true;
  let usage: TokenUsage | undefined;

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

      if (chunk.done && chunk.usage) {
        usage = chunk.usage;
        logger.debug(
          `Tokens — prompt: ${chunk.usage.promptTokens}, completion: ${chunk.usage.completionTokens}, total: ${chunk.usage.totalTokens}`,
        );
      }
    }

    if (firstToken) {
      spinner.stop();
    }

    // Ensure newline after streaming
    if (fullContent && !fullContent.endsWith('\n')) {
      process.stdout.write('\n');
    }

    return fullContent ? { content: fullContent, usage } : null;
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
 */
async function handleSlashCommand(
  command: string,
  messages: ConversationMessage[],
  state: SessionState,
  _provider: GroqProvider,
): Promise<'exit' | 'handled' | 'unhandled'> {
  const parts = command.split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  switch (cmd) {
    case '/exit':
    case '/quit':
      return 'exit';

    case '/clear':
      messages.length = 1;
      state.messageCount = 0;
      state.tokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      console.error(chalk.gray('🧹 Conversation cleared.'));
      return 'handled';

    case '/reset': {
      messages.length = 0;
      messages.push(createSystemMessage());
      state.sessionId = initNewSession(state.model);
      state.messageCount = 0;
      state.tokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      state.startTime = Date.now();
      console.error(chalk.gray('🔄 New session started.'));
      return 'handled';
    }

    case '/model': {
      const newModel = parts[1];
      if (newModel) {
        state.model = newModel;
        console.error(chalk.gray(`Model switched to: ${chalk.cyan(newModel)}`));
      } else {
        console.error(chalk.gray(`Current model: ${chalk.cyan(state.model)}`));
        console.error(chalk.gray('  Switch with: /model <model-id>'));
        console.error(chalk.gray('  Available: llama-3.3-70b-versatile, llama-3.1-8b-instant'));
      }
      return 'handled';
    }

    case '/history':
    case '/sessions': {
      const sessions = listSessions(10);
      if (sessions.length === 0) {
        console.error(chalk.gray('No session history yet.'));
      } else {
        console.error(chalk.bold('\n  Recent Sessions:'));
        for (const s of sessions) {
          const date = new Date(s.updatedAt).toLocaleDateString();
          const time = new Date(s.updatedAt).toLocaleTimeString();
          const active = s.id === state.sessionId ? chalk.green(' (active)') : '';
          console.error(
            chalk.gray(`  ${s.id.slice(0, 8)}`) +
              ` ${s.title}` +
              chalk.gray(` — ${date} ${time}`) +
              active,
          );
        }
        console.error('');
      }
      return 'handled';
    }

    case '/tokens': {
      console.error(chalk.bold('\n  Token Usage:'));
      console.error(chalk.gray('  Prompt tokens:     ') + chalk.yellow(state.tokens.promptTokens.toLocaleString()));
      console.error(chalk.gray('  Completion tokens: ') + chalk.yellow(state.tokens.completionTokens.toLocaleString()));
      console.error(chalk.gray('  Total tokens:      ') + chalk.bold.yellow(state.tokens.totalTokens.toLocaleString()));
      console.error(chalk.gray('  Session duration:  ') + formatDuration(Date.now() - state.startTime));
      console.error('');
      return 'handled';
    }

    case '/compact': {
      const keepCount = parseInt(parts[1] || '6', 10);
      const systemMsg = messages[0];
      const recent = messages.slice(-keepCount);
      messages.length = 0;
      if (systemMsg) messages.push(systemMsg);
      messages.push(...recent);
      console.error(chalk.gray(`📦 Context compacted to ${messages.length} messages.`));
      return 'handled';
    }

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
- You are in Phase 1 — interactive chat with rich terminal output. Full agentic tool calling is coming in Phase 2.

## Response Formatting
- Use markdown formatting (headers, bold, code blocks, lists)
- Your output is rendered in the terminal with syntax highlighting
- Keep responses focused and actionable

Be helpful, accurate, and fast.`;
}

/** Create a system message. */
function createSystemMessage(): ConversationMessage {
  return {
    id: generateId(),
    role: 'system',
    content: buildSystemPrompt(),
    timestamp: now(),
  };
}

/** Initialize a new session in SQLite. */
function initNewSession(model: string): string {
  try {
    const session = createSession(process.cwd(), model);
    logger.debug(`New session created: ${session.id}`);
    return session.id;
  } catch (error) {
    logger.debug(`Session storage unavailable: ${error}`);
    return generateId();
  }
}

/** End the session gracefully. */
async function endSession(state: SessionState): Promise<void> {
  const duration = formatDuration(Date.now() - state.startTime);
  console.error('');
  console.error(
    chalk.gray(
      `👋 Session ended — ${state.messageCount} messages, ${state.tokens.totalTokens.toLocaleString()} tokens, ${duration}`,
    ),
  );

  try {
    updateSession(state.sessionId, {
      status: 'completed',
      totalTokens: state.tokens,
    });
  } catch {
    // Session storage may not be available
  }
}

/**
 * Print the welcome banner with gradient.
 */
function printWelcome(state: SessionState): void {
  const banner = gradientString.pastel.multiline(
    [
      '╔══════════════════════════════════════════════╗',
      '║            ⚡  F R E E - C L I  ⚡          ║',
      '║   Your terminal. Your AI. Groq fast.        ║',
      '╚══════════════════════════════════════════════╝',
    ].join('\n'),
  );

  console.error('');
  console.error(banner);
  console.error('');

  const info = [
    `${chalk.gray('Model:')}   ${chalk.cyan(state.model)}`,
    `${chalk.gray('Session:')} ${chalk.yellow(state.sessionId.slice(0, 8))}`,
    `${chalk.gray('Help:')}    ${chalk.white('/help')}  ${chalk.gray('Exit:')} ${chalk.white('/exit')}`,
  ].join('\n');

  console.error(
    boxen(info, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: 'gray',
      dimBorder: true,
    }),
  );

  console.error('');
}

/**
 * Print slash command help.
 */
function printSlashHelp(): void {
  console.error('');
  console.error(chalk.bold('  Available Commands:'));
  console.error('');
  console.error(chalk.cyan('  /clear     ') + chalk.gray('Clear conversation context'));
  console.error(chalk.cyan('  /reset     ') + chalk.gray('Start a fresh session'));
  console.error(chalk.cyan('  /model     ') + chalk.gray('Show or switch model (/model llama-3.1-8b-instant)'));
  console.error(chalk.cyan('  /history   ') + chalk.gray('Show recent sessions'));
  console.error(chalk.cyan('  /tokens    ') + chalk.gray('Show token usage for this session'));
  console.error(chalk.cyan('  /compact   ') + chalk.gray('Compact context to last N messages'));
  console.error(chalk.cyan('  /tools     ') + chalk.gray('List available tools (Phase 2)'));
  console.error(chalk.cyan('  /help      ') + chalk.gray('Show this help message'));
  console.error(chalk.cyan('  /exit      ') + chalk.gray('End the session'));
  console.error('');
}
