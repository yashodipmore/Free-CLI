/**
 * @free-cli/cli — Tool Registry
 *
 * Central registry for all tools (built-in and MCP).
 * Provides registration, lookup, and LLM schema generation.
 */

import type { ToolDefinition, LLMToolSchema } from '@free-cli/core';
import { toLLMToolSchema } from '@free-cli/core';
import { logger } from '../utils/logger.js';

/**
 * Central tool registry — singleton.
 */
class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  /**
   * Register a tool definition.
   * Throws if a tool with the same name already exists.
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool "${tool.name}" is already registered — overwriting.`);
    }
    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool: ${tool.name} [${tool.source}/${tool.safetyLevel}]`);
  }

  /**
   * Register multiple tools at once.
   */
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name.
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all enabled tools.
   */
  getAll(): ToolDefinition[] {
    return [...this.tools.values()].filter((t) => t.enabled);
  }

  /**
   * Get all tools as LLM-consumable schemas for function calling.
   */
  toLLMSchemas(): LLMToolSchema[] {
    return this.getAll().map(toLLMToolSchema);
  }

  /**
   * Get tools filtered by source.
   */
  getBySource(source: 'builtin' | 'mcp' | 'plugin'): ToolDefinition[] {
    return this.getAll().filter((t) => t.source === source);
  }

  /**
   * Remove a tool by name.
   */
  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get total count of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Clear all registered tools.
   */
  clear(): void {
    this.tools.clear();
  }
}

/** Singleton tool registry instance */
export const toolRegistry = new ToolRegistry();
