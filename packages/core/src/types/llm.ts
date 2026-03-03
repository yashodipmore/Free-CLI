/**
 * @free-cli/core — LLM Types
 *
 * Type definitions for LLM provider abstraction,
 * model configuration, and streaming responses.
 */

import type { ConversationMessage, TokenUsage, ToolCallRequest } from './agent.js';
import type { LLMToolSchema } from './tools.js';

/** Supported LLM provider identifiers */
export type LLMProvider = 'groq' | 'ollama' | 'openrouter';

/** Model information */
export interface ModelInfo {
  /** Model ID as used in API calls (e.g., 'llama-3.3-70b-versatile') */
  id: string;
  /** Human-friendly name */
  name: string;
  /** Which provider serves this model */
  provider: LLMProvider;
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Whether this model supports function calling */
  supportsFunctionCalling: boolean;
  /** Whether this model supports vision (image inputs) */
  supportsVision: boolean;
  /** Whether this model supports streaming */
  supportsStreaming: boolean;
}

/** Request to send to an LLM provider */
export interface LLMRequest {
  /** Model ID to use */
  model: string;
  /** Messages to send */
  messages: ConversationMessage[];
  /** Available tools (optional) */
  tools?: LLMToolSchema[];
  /** Temperature (0-2, default 0.7) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Whether to stream the response */
  stream: boolean;
  /** Stop sequences */
  stop?: string[];
}

/** A complete (non-streaming) LLM response */
export interface LLMResponse {
  /** The assistant's message content */
  content: string;
  /** Tool calls requested (if any) */
  toolCalls: ToolCallRequest[];
  /** Token usage for this call */
  usage: TokenUsage;
  /** Which model actually handled the request */
  model: string;
  /** Response latency in milliseconds */
  latencyMs: number;
  /** Finish reason */
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

/** A single chunk in a streaming LLM response */
export interface LLMStreamChunk {
  /** Incremental text content (may be empty during tool call streaming) */
  content: string;
  /** Incremental tool call data */
  toolCallDelta?: {
    /** Index of the tool call being streamed */
    index: number;
    /** Tool call ID (only in the first chunk for this tool call) */
    id?: string;
    /** Function name (only in the first chunk for this tool call) */
    name?: string;
    /** Incremental function arguments JSON string */
    arguments: string;
  };
  /** Whether this is the final chunk */
  done: boolean;
  /** Token usage (only available in the final chunk) */
  usage?: TokenUsage;
  /** Finish reason (only available in the final chunk) */
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
}

/** Abstract interface that all LLM providers must implement */
export interface LLMProviderInterface {
  /** Provider identifier */
  readonly provider: LLMProvider;

  /** Check if the provider is available and configured */
  isAvailable(): Promise<boolean>;

  /** Get list of available models */
  listModels(): Promise<ModelInfo[]>;

  /** Send a non-streaming chat completion request */
  chat(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Send a streaming chat completion request.
   * Returns an async iterable of stream chunks.
   */
  chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
}

/** Available Groq models with their configurations */
export const GROQ_MODELS: ModelInfo[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'groq',
    contextWindow: 128_000,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsStreaming: true,
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    contextWindow: 128_000,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsStreaming: true,
  },
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B Vision',
    provider: 'groq',
    contextWindow: 128_000,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
  },
];

/** Default model to use */
export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
