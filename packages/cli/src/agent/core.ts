/**
 * @free-cli/cli — Agent Core
 *
 * Implements the ReAct (Reason + Act) agent loop.
 *
 * Flow: User prompt → Context injection → LLM call (streaming) →
 *       Tool call detection → Permission check → Execution →
 *       Result injection → Next LLM call → ... → Final response
 *
 * The agent continues until:
 * - The LLM produces a final text response (no tool calls)
 * - Max iterations are reached
 * - The user cancels
 * - An unrecoverable error occurs
 */

import chalk from 'chalk';
import ora from 'ora';
import type {
  ConversationMessage,
  AgentConfig,
  AgentStatus,
  TokenUsage,
  ToolCallRequest,
  ToolCallResult,
  LLMStreamChunk,
} from '@free-cli/core';
import { generateId, now } from '@free-cli/core';
import type { GroqProvider } from '../llm/groq.js';
import { toolRegistry } from '../tools/registry.js';
import { executeToolCalls } from '../tools/executor.js';
import { ContextManager } from './context.js';
import { logger } from '../utils/logger.js';

/** Events emitted during an agent run */
export interface AgentEvent {
  type:
    | 'status_change'
    | 'stream_token'
    | 'tool_call_start'
    | 'tool_call_end'
    | 'iteration_end'
    | 'final_response'
    | 'error';
  status?: AgentStatus;
  content?: string;
  toolCall?: ToolCallRequest;
  toolResult?: ToolCallResult;
  iteration?: number;
  usage?: TokenUsage;
  error?: string;
}

/** Callback type for agent events */
export type AgentEventHandler = (event: AgentEvent) => void;

/**
 * The Agent — runs the ReAct loop against an LLM with tool calling.
 */
export class Agent {
  private readonly provider: GroqProvider;
  private readonly contextManager: ContextManager;
  private readonly config: AgentConfig;
  private status: AgentStatus = 'idle';
  private eventHandler: AgentEventHandler | undefined;
  private aborted = false;

  /** Full conversation history (persisted across runs) */
  private messages: ConversationMessage[] = [];

  /** Cumulative token usage */
  private totalTokens: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor(
    provider: GroqProvider,
    config: AgentConfig,
    contextManager: ContextManager,
  ) {
    this.provider = provider;
    this.config = config;
    this.contextManager = contextManager;
  }

  /**
   * Set the event handler for streaming UI updates.
   */
  onEvent(handler: AgentEventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Get current agent status.
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get cumulative token usage.
   */
  getTokenUsage(): TokenUsage {
    return { ...this.totalTokens };
  }

  /**
   * Get conversation messages.
   */
  getMessages(): ConversationMessage[] {
    return [...this.messages];
  }

  /**
   * Load existing messages (e.g., from session resume).
   */
  loadMessages(messages: ConversationMessage[]): void {
    this.messages = [...messages];
  }

  /**
   * Abort the current run.
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Run the agent with a user prompt.
   * This is the main entry point — runs the full ReAct loop.
   *
   * Returns the final assistant response content.
   */
  async run(userPrompt: string): Promise<string> {
    this.aborted = false;

    // 1. Process user message (expand @file, @url references)
    const processedPrompt = await this.contextManager.processUserMessage(userPrompt);

    // 2. Add user message to history
    const userMsg: ConversationMessage = {
      id: generateId(),
      role: 'user',
      content: processedPrompt,
      timestamp: now(),
    };
    this.messages.push(userMsg);

    // 3. Build system prompt (with tools, env context, FREE-CLI.md)
    const systemPrompt = await this.contextManager.buildSystemPrompt();

    // 4. Run the ReAct loop
    let finalContent = '';
    let iteration = 0;

    while (iteration < this.config.maxIterations) {
      if (this.aborted) {
        this.setStatus('idle');
        return '[Agent aborted by user]';
      }

      iteration++;
      logger.debug(`Agent iteration ${iteration}/${this.config.maxIterations}`);

      // Build context window (respects token budget)
      const contextMessages = this.contextManager.buildContextWindow(
        systemPrompt,
        this.messages,
      );

      // Call the LLM with tools
      this.setStatus('thinking');

      const { content, toolCalls, usage } = await this.llmCall(contextMessages);

      // Track tokens
      if (usage) {
        this.totalTokens.promptTokens += usage.promptTokens;
        this.totalTokens.completionTokens += usage.completionTokens;
        this.totalTokens.totalTokens += usage.totalTokens;
      }

      // If no tool calls, this is the final response
      if (!toolCalls || toolCalls.length === 0) {
        finalContent = content;

        // Add final assistant message to history
        const assistantMsg: ConversationMessage = {
          id: generateId(),
          role: 'assistant',
          content: finalContent,
          timestamp: now(),
        };
        this.messages.push(assistantMsg);

        this.emit({
          type: 'final_response',
          content: finalContent,
          usage: this.totalTokens,
          iteration,
        });

        this.setStatus('completed');
        return finalContent;
      }

      // Add assistant message with tool calls to history
      const assistantMsg: ConversationMessage = {
        id: generateId(),
        role: 'assistant',
        content: content || '',
        toolCalls,
        timestamp: now(),
      };
      this.messages.push(assistantMsg);

      // If the assistant also included text content before tool calls, stream it
      if (content) {
        this.emit({ type: 'stream_token', content: '\n' });
      }

      // Execute tool calls
      this.setStatus('executing_tool');
      const toolResults = await this.executeTools(toolCalls);

      // Add tool results to conversation history
      for (const result of toolResults) {
        const toolMsg: ConversationMessage = {
          id: generateId(),
          role: 'tool',
          content: result.content,
          toolCallId: result.toolCallId,
          timestamp: now(),
        };
        this.messages.push(toolMsg);
      }

      this.emit({
        type: 'iteration_end',
        iteration,
        usage: this.totalTokens,
      });
    }

    // Max iterations reached
    this.setStatus('max_iterations_reached');
    const maxIterMsg = `\n[Reached maximum iterations (${this.config.maxIterations}). The task may be incomplete.]`;
    this.emit({
      type: 'error',
      error: maxIterMsg,
    });

    return finalContent || maxIterMsg;
  }

  // ── Private methods ──────────────────────────────────────────

  /**
   * Call the LLM with streaming, accumulating tool call deltas.
   * Returns the full response content and any tool calls.
   */
  private async llmCall(
    messages: ConversationMessage[],
  ): Promise<{
    content: string;
    toolCalls: ToolCallRequest[] | null;
    usage: TokenUsage | null;
  }> {
    const tools = toolRegistry.toLLMSchemas();

    let fullContent = '';
    let usage: TokenUsage | null = null;

    // Accumulate tool call deltas
    const toolCallAccumulator = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    let spinner: ReturnType<typeof ora> | null = ora({
      text: chalk.gray('Thinking...'),
      spinner: 'dots',
      stream: process.stderr,
    }).start();

    let firstTextToken = true;

    try {
      const stream = this.provider.chatStream({
        model: this.config.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        stream: true,
        temperature: 0.7,
      });

      for await (const chunk of stream as AsyncIterable<LLMStreamChunk>) {
        if (this.aborted) break;

        // Text content
        if (chunk.content) {
          if (firstTextToken && spinner) {
            spinner.stop();
            process.stderr.write('\x1B[2K\r');
            spinner = null;
            firstTextToken = false;
            this.setStatus('streaming');
          }

          fullContent += chunk.content;
          process.stdout.write(chunk.content);
          this.emit({ type: 'stream_token', content: chunk.content });
        }

        // Tool call delta
        if (chunk.toolCallDelta) {
          if (firstTextToken && spinner) {
            spinner.stop();
            process.stderr.write('\x1B[2K\r');
            spinner = null;
            firstTextToken = false;
          }

          const delta = chunk.toolCallDelta;
          const existing = toolCallAccumulator.get(delta.index);

          if (existing) {
            existing.arguments += delta.arguments;
          } else {
            toolCallAccumulator.set(delta.index, {
              id: delta.id ?? `call_${delta.index}`,
              name: delta.name ?? '',
              arguments: delta.arguments,
            });
          }
        }

        // Usage info
        if (chunk.done && chunk.usage) {
          usage = chunk.usage;
        }
      }

      // Ensure we stop any spinner
      if (spinner) {
        spinner.stop();
        process.stderr.write('\x1B[2K\r');
      }

      // Ensure newline after streamed text
      if (fullContent && !fullContent.endsWith('\n')) {
        process.stdout.write('\n');
      }

      // Build tool calls from accumulated deltas
      const toolCalls: ToolCallRequest[] | null =
        toolCallAccumulator.size > 0
          ? [...toolCallAccumulator.values()].map((tc) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            }))
          : null;

      return { content: fullContent, toolCalls, usage };
    } catch (error) {
      if (spinner) spinner.fail(chalk.red('Error'));

      const msg = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'error', error: msg });
      throw error;
    }
  }

  /**
   * Execute tool calls with UI feedback.
   */
  private async executeTools(toolCalls: ToolCallRequest[]): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];

    for (const toolCall of toolCalls) {
      // Show tool call indicator
      const toolEmoji = this.getToolEmoji(toolCall.name);
      console.error(
        chalk.cyan(`\n${toolEmoji} ${toolCall.name}`) +
          chalk.gray(` ${this.summarizeArgs(toolCall.arguments)}`),
      );

      this.emit({
        type: 'tool_call_start',
        toolCall,
      });

      const spinner = ora({
        text: chalk.gray(`Running ${toolCall.name}...`),
        spinner: 'dots',
        stream: process.stderr,
      }).start();

      // Execute one at a time for sequential permisson prompts
      const [result] = await executeToolCalls([toolCall], this.config.approvalMode);

      if (result) {
        if (result.success) {
          spinner.succeed(
            chalk.green(`${toolCall.name}`) +
              chalk.gray(` (${result.durationMs}ms)`),
          );
        } else {
          spinner.fail(
            chalk.red(`${toolCall.name} failed`) +
              chalk.gray(`: ${result.error ?? 'unknown error'}`),
          );
        }

        results.push(result);

        this.emit({
          type: 'tool_call_end',
          toolCall,
          toolResult: result,
        });
      }
    }

    return results;
  }

  /**
   * Set agent status and emit status change event.
   */
  private setStatus(status: AgentStatus): void {
    this.status = status;
    this.emit({ type: 'status_change', status });
  }

  /**
   * Emit an event to the event handler.
   */
  private emit(event: AgentEvent): void {
    if (this.eventHandler) {
      try {
        this.eventHandler(event);
      } catch (error) {
        logger.debug(`Event handler error: ${error}`);
      }
    }
  }

  /**
   * Get a contextual emoji for a tool.
   */
  private getToolEmoji(toolName: string): string {
    if (toolName.startsWith('read_file') || toolName.startsWith('list_directory'))
      return '📖';
    if (toolName.startsWith('write_file') || toolName.startsWith('edit_file'))
      return '✏️';
    if (toolName === 'shell_execute') return '⚡';
    if (toolName.startsWith('git_')) return '🔀';
    if (toolName === 'web_search') return '🔍';
    return '🔧';
  }

  /**
   * Create a concise summary of tool call arguments.
   */
  private summarizeArgs(argsJson: string): string {
    try {
      const args = JSON.parse(argsJson) as Record<string, unknown>;
      const parts: string[] = [];

      if (args['path']) parts.push(String(args['path']));
      if (args['command']) {
        const cmd = String(args['command']);
        parts.push(cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd);
      }
      if (args['query']) parts.push(`"${String(args['query'])}"`);
      if (args['message']) parts.push(`"${String(args['message'])}"`);

      return parts.length > 0 ? `→ ${parts.join(' ')}` : '';
    } catch {
      return '';
    }
  }
}

/**
 * Create and configure a new agent with default settings.
 */
export function createAgent(options: {
  provider: GroqProvider;
  config: AgentConfig;
  cwd?: string;
}): Agent {
  const cwd = options.cwd ?? process.cwd();

  const contextManager = new ContextManager({
    cwd,
    contextWindowTokens: options.config.contextWindowTokens,
  });

  return new Agent(options.provider, options.config, contextManager);
}
