/**
 * @free-cli/cli — Context Manager
 *
 * Manages the LLM context window intelligently:
 * - Injects cwd, git status, platform info into system prompt
 * - Loads FREE-CLI.md project-level instructions (a la GEMINI.md / CLAUDE.md)
 * - Processes @file and @url references in user messages
 * - Maintains rolling window with context compaction
 * - Tracks token budget to avoid exceeding model limits
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';
import type { ConversationMessage } from '@free-cli/core';
import { generateId, now, getOSName, VERSION } from '@free-cli/core';
import { toolRegistry } from '../tools/registry.js';
import { logger } from '../utils/logger.js';

/** Approximate tokens per character (conservative) */
const CHARS_PER_TOKEN = 4;

/** Maximum chars to inject from a single @file reference */
const MAX_FILE_INJECT_CHARS = 50_000;

/** FREE-CLI.md filenames to search for (in priority order) */
const PROJECT_CONTEXT_FILES = ['FREE-CLI.md', 'FREECLI.md', '.free-cli.md'];

export interface ContextManagerOptions {
  /** Working directory */
  cwd: string;
  /** Model context window in tokens */
  contextWindowTokens: number;
  /** Max tokens to reserve for completion (output) */
  maxCompletionTokens?: number;
  /** Custom system prompt override */
  systemPromptOverride?: string;
}

/**
 * Context Manager — orchestrates what context the LLM sees.
 */
export class ContextManager {
  private readonly cwd: string;
  private readonly contextWindowTokens: number;
  private readonly maxCompletionTokens: number;
  private projectContext: string | null = null;
  private projectContextLoaded = false;

  constructor(private readonly options: ContextManagerOptions) {
    this.cwd = options.cwd;
    this.contextWindowTokens = options.contextWindowTokens;
    this.maxCompletionTokens = options.maxCompletionTokens ?? 8192;
  }

  /**
   * Build the full system prompt with environment context,
   * tool descriptions, and project-level instructions.
   */
  async buildSystemPrompt(): Promise<string> {
    const parts: string[] = [];

    // Core identity
    parts.push(`You are Free-CLI (fcli) v${VERSION}, an AI coding agent running inside the user's terminal.`);
    parts.push('You are powered by Groq LPU inference for blazing-fast responses.\n');

    // Environment context
    parts.push('## Environment');
    parts.push(`- Working Directory: ${this.cwd}`);
    parts.push(`- Platform: ${getOSName()} (${process.platform} ${process.arch})`);
    parts.push(`- Node.js: ${process.version}`);
    parts.push(`- Shell: ${process.env['SHELL'] ?? 'unknown'}`);
    parts.push(`- Date: ${new Date().toISOString().split('T')[0]}`);

    // Git context (brief)
    const gitInfo = this.getGitContext();
    if (gitInfo) {
      parts.push(`\n## Git Repository`);
      parts.push(gitInfo);
    }

    // Available tools
    const tools = toolRegistry.getAll();
    if (tools.length > 0) {
      parts.push('\n## Available Tools');
      parts.push('You have the following tools available. Call them using function calling when needed:\n');
      for (const tool of tools) {
        parts.push(`- **${tool.name}** [${tool.safetyLevel}]: ${tool.description}`);
      }
    }

    // Project context (FREE-CLI.md)
    const projectCtx = await this.loadProjectContext();
    if (projectCtx) {
      parts.push('\n## Project Instructions (from FREE-CLI.md)');
      parts.push(projectCtx);
    }

    // Agent behavior guidelines
    parts.push('\n## Guidelines');
    parts.push('- You are an agentic AI — use tools to accomplish tasks step by step');
    parts.push('- Read files before editing them to understand the full context');
    parts.push('- Use shell_execute for running builds, tests, and other commands');
    parts.push('- After making changes, verify them by reading the result or running tests');
    parts.push('- Be concise in explanations — this is a terminal environment');
    parts.push('- Use markdown formatting for structured output');
    parts.push('- If a task requires multiple steps, plan before acting');
    parts.push('- IMPORTANT: When you have completed the task or answered the question, stop calling tools and provide your final response');

    return parts.join('\n');
  }

  /**
   * Process a user message, expanding @file and @url references.
   */
  async processUserMessage(content: string): Promise<string> {
    let processed = content;

    // Expand @file references: @path/to/file.ts
    const fileRefs = content.match(/@([\w./-]+\.\w+)/g);
    if (fileRefs) {
      for (const ref of fileRefs) {
        const filePath = ref.slice(1); // Remove @
        const expanded = await this.expandFileReference(filePath);
        if (expanded) {
          processed = processed.replace(ref, expanded);
        }
      }
    }

    // Expand @url references: @https://...
    const urlRefs = content.match(/@(https?:\/\/[^\s]+)/g);
    if (urlRefs) {
      for (const ref of urlRefs) {
        const url = ref.slice(1); // Remove @
        const expanded = await this.expandUrlReference(url);
        if (expanded) {
          processed = processed.replace(ref, expanded);
        }
      }
    }

    return processed;
  }

  /**
   * Build the message list for an LLM call, managing context window.
   * Returns a list of messages that fits within the token budget.
   */
  buildContextWindow(
    systemPrompt: string,
    messages: ConversationMessage[],
  ): ConversationMessage[] {
    const budgetTokens = this.contextWindowTokens - this.maxCompletionTokens;
    const systemTokens = this.estimateTokens(systemPrompt);

    // Always include system prompt
    let usedTokens = systemTokens;
    const result: ConversationMessage[] = [
      {
        id: generateId(),
        role: 'system',
        content: systemPrompt,
        timestamp: now(),
      },
    ];

    // Add messages from most recent backwards, until budget is exceeded
    const messagesToAdd: ConversationMessage[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg || msg.role === 'system') continue;

      const msgTokens = this.estimateTokens(msg.content) + 10; // +10 for metadata
      if (usedTokens + msgTokens > budgetTokens) {
        logger.debug(`Context window: dropping message ${i} (would exceed ${budgetTokens} tokens)`);
        break;
      }

      usedTokens += msgTokens;
      messagesToAdd.unshift(msg);
    }

    result.push(...messagesToAdd);

    logger.debug(
      `Context window: ${result.length} messages, ~${usedTokens}/${budgetTokens} tokens used`,
    );

    return result;
  }

  /**
   * Estimate token count for a string.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  // ── Private helpers ────────────────────────────────────────────

  /**
   * Load FREE-CLI.md project context file.
   */
  private async loadProjectContext(): Promise<string | null> {
    if (this.projectContextLoaded) return this.projectContext;
    this.projectContextLoaded = true;

    for (const filename of PROJECT_CONTEXT_FILES) {
      const filePath = resolve(this.cwd, filename);
      if (existsSync(filePath)) {
        try {
          const content = await readFile(filePath, 'utf-8');
          // Limit size to avoid blowing context budget
          if (content.length > 10_000) {
            this.projectContext = content.slice(0, 10_000) + '\n\n... (truncated)';
          } else {
            this.projectContext = content;
          }
          logger.debug(`Loaded project context from ${filename} (${content.length} chars)`);
          return this.projectContext;
        } catch (error) {
          logger.warn(`Failed to load ${filename}: ${error}`);
        }
      }
    }

    return null;
  }

  /**
   * Get brief git context for the system prompt.
   */
  private getGitContext(): string | null {
    try {
      const branch = execSync('git branch --show-current', {
        cwd: this.cwd,
        timeout: 3_000,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      const status = execSync('git status --porcelain', {
        cwd: this.cwd,
        timeout: 3_000,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      const changedCount = status ? status.split('\n').length : 0;

      let info = `- Branch: ${branch}`;
      if (changedCount > 0) {
        info += `\n- Changed files: ${changedCount}`;
      } else {
        info += '\n- Working tree: clean';
      }

      return info;
    } catch {
      return null; // Not a git repo or git not installed
    }
  }

  /**
   * Expand a @file reference to inline file contents.
   */
  private async expandFileReference(filePath: string): Promise<string | null> {
    try {
      const absPath = resolve(this.cwd, filePath);
      if (!existsSync(absPath)) {
        return `[File not found: ${filePath}]`;
      }

      const content = await readFile(absPath, 'utf-8');
      if (content.length > MAX_FILE_INJECT_CHARS) {
        return `\n<file path="${relative(this.cwd, absPath)}">\n${content.slice(0, MAX_FILE_INJECT_CHARS)}\n... (truncated at ${MAX_FILE_INJECT_CHARS} chars)\n</file>`;
      }

      return `\n<file path="${relative(this.cwd, absPath)}">\n${content}\n</file>`;
    } catch (error) {
      logger.debug(`Failed to expand @${filePath}: ${error}`);
      return `[Error reading file: ${filePath}]`;
    }
  }

  /**
   * Expand a @url reference by fetching the URL content.
   */
  private async expandUrlReference(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'free-cli/0.1.0' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return `[Failed to fetch ${url}: HTTP ${response.status}]`;
      }

      const text = await response.text();
      const truncated =
        text.length > MAX_FILE_INJECT_CHARS
          ? text.slice(0, MAX_FILE_INJECT_CHARS) + '\n... (truncated)'
          : text;

      return `\n<url src="${url}">\n${truncated}\n</url>`;
    } catch (error) {
      logger.debug(`Failed to expand @${url}: ${error}`);
      return `[Error fetching URL: ${url}]`;
    }
  }
}
