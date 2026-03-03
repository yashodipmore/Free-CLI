/**
 * @free-cli/core — Tool Types
 *
 * Type definitions for the unified tool registry,
 * built-in tools, and MCP tool integration.
 */

import type { ToolCallResult } from './agent.js';

/** Safety classification for tools */
export type ToolSafetyLevel = 'read-only' | 'safe-write' | 'destructive';

/** JSON Schema representation for tool parameters */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/** JSON Schema property definition */
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  default?: unknown;
}

/** Source of a registered tool */
export type ToolSource = 'builtin' | 'mcp' | 'plugin';

/** Complete tool definition for the registry */
export interface ToolDefinition {
  /** Unique tool name (e.g., 'filesystem_read', 'shell_execute') */
  name: string;
  /** Human-readable description for the LLM */
  description: string;
  /** JSON Schema for the tool's input parameters */
  parameters: ToolParameterSchema;
  /** Safety classification */
  safetyLevel: ToolSafetyLevel;
  /** Where this tool came from */
  source: ToolSource;
  /** Timeout for this specific tool in milliseconds (0 = use default) */
  timeout: number;
  /** Whether this tool is currently enabled */
  enabled: boolean;
  /**
   * Execute the tool with the given arguments.
   * Returns a result string or throws on failure.
   */
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/** Simplified tool schema for sending to the LLM (Groq function calling format) */
export interface LLMToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
  };
}

/** Convert a ToolDefinition to LLM-consumable schema */
export function toLLMToolSchema(tool: ToolDefinition): LLMToolSchema {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

/** Tool execution event (for hooks and logging) */
export interface ToolExecutionEvent {
  /** Tool name */
  toolName: string;
  /** Parsed arguments */
  args: Record<string, unknown>;
  /** Result (only available in afterToolCall) */
  result?: ToolCallResult;
  /** Timestamp */
  timestamp: number;
}
