/**
 * @free-cli/cli — Tools Index
 *
 * Entry point for tool initialization.
 * Registers all built-in tools with the tool registry.
 */

import { toolRegistry } from './registry.js';
import { getFilesystemTools, getShellTools, getGitTools, getSearchTools } from './builtin/index.js';
import { logger } from '../utils/logger.js';

/**
 * Initialize and register all built-in tools.
 * Call this once at startup before using the agent.
 */
export function initializeBuiltinTools(cwd: string): void {
  toolRegistry.clear();

  const tools = [
    ...getFilesystemTools(cwd),
    ...getShellTools(cwd),
    ...getGitTools(cwd),
    ...getSearchTools(),
  ];

  toolRegistry.registerAll(tools);
  logger.debug(`Initialized ${toolRegistry.size} built-in tools`);
}

export { toolRegistry } from './registry.js';
export { executeTool, executeToolCalls } from './executor.js';
