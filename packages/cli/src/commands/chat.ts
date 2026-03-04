/**
 * @free-cli/cli — Chat Command (Phase 1)
 *
 * Interactive chat mode or one-shot prompt execution.
 * Features: markdown rendering, session persistence, enhanced slash commands,
 * gradient welcome banner, and rich terminal output.
 */

import chalk from 'chalk';
import boxen from 'boxen';
import gradientString from 'gradient-string';
import { input } from '@inquirer/prompts';
import { generateId, now, formatDuration } from '@free-cli/core';
import type { ConversationMessage, TokenUsage, AgentConfig, ApprovalMode } from '@free-cli/core';
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
import { initializeBuiltinTools, toolRegistry } from '../tools/index.js';
import { createAgent } from '../agent/core.js';

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

  // Initialize built-in tools
  const cwd = process.cwd();
  initializeBuiltinTools(cwd);
  logger.debug(`Registered ${toolRegistry.size} tools`);

  // Build agent config
  const agentConfig: AgentConfig = {
    maxIterations: 20,
    toolTimeout: 30_000,
    approvalMode: (getConfig('approvalMode') as ApprovalMode) || 'ask',
    model,
    contextWindowTokens: 100_000,
  };

  // One-shot mode — use the agent for agentic task execution
  if (prompt) {
    await executeOneShot(provider, model, prompt, agentConfig);
    return;
  }

  // Interactive REPL mode
  await interactiveREPL(provider, model, options.resume, agentConfig);
}

/**
 * Execute a single prompt using the full agent with tool calling.
 */
async function executeOneShot(
  provider: GroqProvider,
  model: string,
  prompt: string,
  agentConfig: AgentConfig,
): Promise<void> {
  const agent = createAgent({ provider, config: agentConfig });

  try {
    await agent.run(prompt);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n  ${error.message}`));
      logger.debug(`Full error: ${error.stack}`);
    }
  }
}

/**
 * Run the interactive REPL loop with session persistence and agent tool calling.
 */
async function interactiveREPL(
  provider: GroqProvider,
  model: string,
  resumeId?: string,
  agentConfig?: AgentConfig,
): Promise<void> {
  // Initialize or resume session
  let messages: ConversationMessage[];
  let sessionId: string;

  if (resumeId) {
    const existingMessages = getSessionMessages(resumeId);
    if (existingMessages.length === 0) {
      console.error(chalk.yellow(`Session ${resumeId} not found. Starting new session.`));
      sessionId = initNewSession(model);
      messages = [];
    } else {
      sessionId = resumeId;
      messages = existingMessages;
      console.error(chalk.green(`✓ Resumed session ${sessionId.slice(0, 8)} (${existingMessages.length} messages)`));
    }
  } else {
    sessionId = initNewSession(model);
    messages = [];
  }

  // Create the agent
  const config = agentConfig ?? {
    maxIterations: 20,
    toolTimeout: 30_000,
    approvalMode: 'ask' as ApprovalMode,
    model,
    contextWindowTokens: 100_000,
  };
  const agent = createAgent({ provider, config });

  // Load existing messages into agent if resuming
  if (messages.length > 0) {
    agent.loadMessages(messages);
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
      const result = await handleSlashCommand(trimmed, agent.getMessages(), state, provider);
      if (result === 'exit') {
        await endSession(state);
        break;
      }
      if (result === 'handled') continue;
    }

    // Run the agent with the user's prompt
    try {
      await agent.run(trimmed);

      // Sync token usage from agent
      const agentTokens = agent.getTokenUsage();
      state.tokens = agentTokens;
      state.messageCount = agent.getMessages().filter((m) => m.role !== 'system').length;

      // Persist to session storage
      const agentMessages = agent.getMessages();
      const lastMessages = agentMessages.slice(-10); // Persist recent messages
      for (const msg of lastMessages) {
        try {
          addMessage(sessionId, msg);
        } catch {
          // Might already exist, that's fine
        }
      }

      // Auto-title after first exchange
      if (state.messageCount <= 3) {
        autoTitleSession(sessionId, trimmed);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`\n  Error: ${error.message}`));
        logger.debug(`Full error: ${error.stack}`);
      }
    }

    console.error(''); // Blank line between turns
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

    case '/tools': {
      const tools = toolRegistry.getAll();
      if (tools.length === 0) {
        console.error(chalk.gray('No tools registered.'));
      } else {
        console.error(chalk.bold('\n  Available Tools:\n'));
        for (const tool of tools) {
          const safety = tool.safetyLevel === 'read-only'
            ? chalk.green(tool.safetyLevel)
            : tool.safetyLevel === 'safe-write'
              ? chalk.yellow(tool.safetyLevel)
              : chalk.red(tool.safetyLevel);
          console.error(
            chalk.cyan(`  ${tool.name}`) +
              chalk.gray(` [${safety}${chalk.gray(']')} — ${tool.description.slice(0, 60)}...`),
          );
        }
        console.error('');
      }
      return 'handled';
    }

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
 * (Used as a fallback — the agent's ContextManager builds a richer prompt.)
 */
function buildSystemPrompt(): string {
  const cwd = process.cwd();
  const nodeVersion = process.version;
  const platform = process.platform;
  const date = new Date().toISOString().split('T')[0];

  const toolCount = toolRegistry.size;

  return `You are Free-CLI (fcli), an AI coding agent running in the user's terminal.
You are powered by Groq's LPU inference engine for blazing-fast responses.

## Current Environment
- Working Directory: ${cwd}
- Platform: ${platform}
- Node.js: ${nodeVersion}
- Date: ${date}
- Tools available: ${toolCount}

## Guidelines
- Be concise and direct — this is a terminal, not a chat app
- When showing code, use markdown code blocks with language identifiers
- If you need to explain something, use bullet points
- For file edits, show the exact changes needed
- You are an agentic AI — use tools to read, write, and execute code
- IMPORTANT: When you have completed the task, stop calling tools and give your final response

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
