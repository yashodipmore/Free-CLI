/**
 * @free-cli/cli — Tool Executor
 *
 * Executes tools safely with timeout enforcement, error handling,
 * and audit logging. Works for both built-in and MCP tools.
 */

import type { ToolCallRequest, ToolCallResult } from '@free-cli/core';
import { safeJsonParse } from '@free-cli/core';
import { toolRegistry } from './registry.js';
import { checkPermission } from '../utils/permissions.js';
import { ToolExecutionError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/** Default tool timeout: 30 seconds */
const DEFAULT_TOOL_TIMEOUT = 30_000;

/**
 * Execute a single tool call from the LLM.
 * Handles permission checks, timeout, and error wrapping.
 */
export async function executeTool(
  toolCall: ToolCallRequest,
  approvalMode: 'auto' | 'ask' | 'strict',
): Promise<ToolCallResult> {
  const startTime = Date.now();
  const tool = toolRegistry.get(toolCall.name);

  if (!tool) {
    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      content: `Error: Tool "${toolCall.name}" not found in registry.`,
      success: false,
      error: `Tool "${toolCall.name}" is not registered.`,
      durationMs: Date.now() - startTime,
    };
  }

  // Parse arguments
  const args = safeJsonParse<Record<string, unknown>>(toolCall.arguments);
  if (!args) {
    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      content: `Error: Failed to parse tool arguments as JSON.`,
      success: false,
      error: 'Invalid JSON in tool call arguments.',
      durationMs: Date.now() - startTime,
    };
  }

  // Permission check
  const permitted = await checkPermission(tool, args, approvalMode);
  if (!permitted) {
    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      content: 'Tool execution denied by user.',
      success: false,
      error: 'Permission denied by user.',
      durationMs: Date.now() - startTime,
    };
  }

  // Execute with timeout
  const timeout = tool.timeout || DEFAULT_TOOL_TIMEOUT;

  try {
    logger.debug(`Executing tool: ${toolCall.name}(${JSON.stringify(args).slice(0, 200)})`);

    const result = await Promise.race([
      tool.execute(args),
      timeoutPromise(timeout, toolCall.name),
    ]);

    const durationMs = Date.now() - startTime;
    logger.debug(`Tool ${toolCall.name} completed in ${durationMs}ms`);

    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      content: result,
      success: true,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    logger.warn(`Tool ${toolCall.name} failed: ${errorMessage}`);

    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      content: `Error executing ${toolCall.name}: ${errorMessage}`,
      success: false,
      error: errorMessage,
      durationMs,
    };
  }
}

/**
 * Execute multiple tool calls (supports parallel execution).
 */
export async function executeToolCalls(
  toolCalls: ToolCallRequest[],
  approvalMode: 'auto' | 'ask' | 'strict',
): Promise<ToolCallResult[]> {
  // Execute in parallel — each tool call is independent
  return Promise.all(
    toolCalls.map((tc) => executeTool(tc, approvalMode)),
  );
}

/**
 * Create a timeout promise that rejects after the given duration.
 */
function timeoutPromise(ms: number, toolName: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new ToolExecutionError(
          toolName,
          `Tool "${toolName}" timed out after ${ms}ms`,
        ),
      );
    }, ms);
  });
}
