/**
 * @free-cli/core — Agent Types
 *
 * Core type definitions for the ReAct agent loop,
 * conversation messages, and session management.
 */

/** Roles in the conversation */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A single message in the conversation history */
export interface ConversationMessage {
  /** Unique message identifier */
  id: string;
  /** Role of the message sender */
  role: MessageRole;
  /** Text content of the message */
  content: string;
  /** Tool calls requested by the assistant (if any) */
  toolCalls?: ToolCallRequest[];
  /** Tool call ID this message is responding to (for role === 'tool') */
  toolCallId?: string;
  /** Timestamp of when the message was created */
  timestamp: number;
}

/** A tool call the LLM wants to make */
export interface ToolCallRequest {
  /** Unique ID for this tool call (from the LLM response) */
  id: string;
  /** Name of the tool to invoke */
  name: string;
  /** JSON-stringified arguments */
  arguments: string;
}

/** Result of executing a tool */
export interface ToolCallResult {
  /** The tool call ID this result corresponds to */
  toolCallId: string;
  /** Name of the tool that was called */
  toolName: string;
  /** The result content (stringified) */
  content: string;
  /** Whether the tool execution succeeded */
  success: boolean;
  /** Error message if execution failed */
  error?: string;
  /** Execution duration in milliseconds */
  durationMs: number;
}

/** State of a single agent iteration */
export interface AgentIteration {
  /** Iteration number (0-indexed) */
  index: number;
  /** The LLM response for this iteration */
  response: ConversationMessage;
  /** Tool calls made in this iteration */
  toolResults: ToolCallResult[];
  /** Duration of this iteration in milliseconds */
  durationMs: number;
}

/** Overall agent execution status */
export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'executing_tool'
  | 'awaiting_approval'
  | 'streaming'
  | 'completed'
  | 'error'
  | 'max_iterations_reached';

/** Configuration for an agent run */
export interface AgentConfig {
  /** Maximum number of ReAct loop iterations */
  maxIterations: number;
  /** Timeout per tool execution in milliseconds */
  toolTimeout: number;
  /** Approval mode for destructive operations */
  approvalMode: ApprovalMode;
  /** Model to use for this run */
  model: string;
  /** Maximum context window tokens */
  contextWindowTokens: number;
}

/** How to handle permission prompts */
export type ApprovalMode = 'auto' | 'ask' | 'strict';

/** A complete agent session */
export interface Session {
  /** Unique session ID (UUID v4) */
  id: string;
  /** Session title (auto-generated from first message) */
  title: string;
  /** When the session was created */
  createdAt: number;
  /** When the session was last active */
  updatedAt: number;
  /** Full conversation history */
  messages: ConversationMessage[];
  /** Working directory when session started */
  workingDirectory: string;
  /** Agent config used for this session */
  config: AgentConfig;
  /** Total tokens used across all iterations */
  totalTokens: TokenUsage;
  /** Current status */
  status: AgentStatus;
}

/** Token usage tracking */
export interface TokenUsage {
  /** Prompt (input) tokens */
  promptTokens: number;
  /** Completion (output) tokens */
  completionTokens: number;
  /** Total tokens */
  totalTokens: number;
}
