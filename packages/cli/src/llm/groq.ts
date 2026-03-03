/**
 * @free-cli/cli — Groq LLM Provider
 *
 * Primary LLM provider using Groq's LPU inference API.
 * Supports both streaming and non-streaming chat completions
 * with full function calling support.
 */

import Groq from 'groq-sdk';
import type {
  LLMProviderInterface,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ModelInfo,
  TokenUsage,
} from '@free-cli/core';
import { GROQ_MODELS } from '@free-cli/core';
import type { ToolCallRequest } from '@free-cli/core';
import { getApiKey } from '../storage/config.js';
import { AuthenticationError, APIError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Groq LLM Provider implementation.
 *
 * Uses Groq's OpenAI-compatible API via the official groq-sdk.
 * Groq's LPU delivers 300+ tokens/second — the fastest inference available.
 */
export class GroqProvider implements LLMProviderInterface {
  readonly provider = 'groq' as const;
  private client: Groq | null = null;

  /**
   * Get or initialize the Groq client.
   * Lazily creates the client on first use to avoid startup cost.
   */
  private async getClient(): Promise<Groq> {
    if (this.client) return this.client;

    const apiKey = await getApiKey('groq');
    if (!apiKey) {
      throw new AuthenticationError(
        'groq',
        'Groq API key not found. Run "fcli config" to set it up, or set GROQ_API_KEY env var.',
      );
    }

    this.client = new Groq({ apiKey });
    return this.client;
  }

  /**
   * Check if the Groq provider is available (has a valid API key).
   */
  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = await getApiKey('groq');
      return !!apiKey;
    } catch {
      return false;
    }
  }

  /**
   * Return the list of known Groq models.
   */
  async listModels(): Promise<ModelInfo[]> {
    return GROQ_MODELS;
  }

  /**
   * Send a non-streaming chat completion request.
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const client = await this.getClient();
    const startTime = Date.now();

    try {
      const response = await client.chat.completions.create({
        model: request.model,
        messages: this.formatMessages(request),
        tools: request.tools && request.tools.length > 0 ? this.formatTools(request) : undefined,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: false,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new APIError('groq', 'No response choices returned from Groq API');
      }

      const toolCalls: ToolCallRequest[] = (choice.message.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      const usage: TokenUsage = {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      };

      return {
        content: choice.message.content ?? '',
        toolCalls,
        usage,
        model: response.model,
        latencyMs: Date.now() - startTime,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof APIError) throw error;
      throw this.wrapError(error);
    }
  }

  /**
   * Send a streaming chat completion request.
   * Returns an async iterable of stream chunks.
   */
  async *chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const client = await this.getClient();

    try {
      const stream = await client.chat.completions.create({
        model: request.model,
        messages: this.formatMessages(request),
        tools: request.tools && request.tools.length > 0 ? this.formatTools(request) : undefined,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: true,
      });

      // Track usage from x_groq extension field
      let finalUsage: TokenUsage | undefined;

      for await (const chunk of stream) {
        // Groq provides usage via x_groq extension
        const xGroq = (chunk as unknown as Record<string, unknown>)['x_groq'] as
          | { usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }
          | undefined;
        if (xGroq?.usage) {
          finalUsage = {
            promptTokens: xGroq.usage.prompt_tokens,
            completionTokens: xGroq.usage.completion_tokens,
            totalTokens: xGroq.usage.total_tokens,
          };
        }

        const choice = chunk.choices[0];

        if (!choice) {
          // Final chunk with no choices — yield usage if available
          if (finalUsage) {
            yield {
              content: '',
              done: true,
              usage: finalUsage,
            };
          }
          continue;
        }

        if (!choice) continue;

        const delta = choice.delta;
        const toolCallDelta = delta.tool_calls?.[0];

        yield {
          content: delta.content ?? '',
          toolCallDelta: toolCallDelta
            ? {
                index: toolCallDelta.index,
                id: toolCallDelta.id ?? undefined,
                name: toolCallDelta.function?.name ?? undefined,
                arguments: toolCallDelta.function?.arguments ?? '',
              }
            : undefined,
          done: choice.finish_reason !== null && choice.finish_reason !== undefined,
          finishReason: choice.finish_reason
            ? this.mapFinishReason(choice.finish_reason)
            : undefined,
        };
      }
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof APIError) throw error;
      throw this.wrapError(error);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Format conversation messages into Groq API format.
   */
  private formatMessages(
    request: LLMRequest,
  ): Groq.Chat.Completions.ChatCompletionMessageParam[] {
    return request.messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.toolCallId ?? '',
        };
      }

      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: 'assistant' as const,
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        };
      }

      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    });
  }

  /**
   * Format tool definitions into Groq API format.
   */
  private formatTools(
    request: LLMRequest,
  ): Groq.Chat.Completions.ChatCompletionTool[] {
    return (request.tools ?? []).map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters as unknown as Record<string, unknown>,
      },
    }));
  }

  /**
   * Map Groq finish reasons to our standard ones.
   */
  private mapFinishReason(
    reason: string | null,
  ): 'stop' | 'tool_calls' | 'length' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
        return 'tool_calls';
      case 'length':
        return 'length';
      default:
        return 'stop';
    }
  }

  /**
   * Wrap an unknown error into a structured APIError.
   */
  private wrapError(error: unknown): APIError {
    if (error instanceof Groq.APIError) {
      const statusCode = error.status;
      let message = error.message;

      if (statusCode === 429) {
        message = 'Groq rate limit exceeded. Wait a moment and try again.';
        logger.warn('Rate limit hit — consider using a smaller model or waiting.');
      } else if (statusCode === 401) {
        throw new AuthenticationError('groq', 'Invalid Groq API key.');
      }

      return new APIError('groq', message, statusCode, error);
    }

    return new APIError(
      'groq',
      error instanceof Error ? error.message : 'Unknown Groq API error',
      undefined,
      error instanceof Error ? error : undefined,
    );
  }
}
