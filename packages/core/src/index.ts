/**
 * @free-cli/core
 *
 * Shared types and utilities for the Free-CLI monorepo.
 * This package is internal — it is not published to npm.
 */

// Types
export type {
  ConversationMessage,
  MessageRole,
  ToolCallRequest,
  ToolCallResult,
  AgentIteration,
  AgentStatus,
  AgentConfig,
  ApprovalMode,
  Session,
  TokenUsage,
} from './types/agent.js';

export type {
  ToolSafetyLevel,
  ToolParameterSchema,
  JSONSchemaProperty,
  ToolSource,
  ToolDefinition,
  LLMToolSchema,
  ToolExecutionEvent,
} from './types/tools.js';
export { toLLMToolSchema } from './types/tools.js';

export type {
  LLMProvider,
  ModelInfo,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMProviderInterface,
} from './types/llm.js';
export { GROQ_MODELS, DEFAULT_MODEL } from './types/llm.js';

export type {
  UserConfig,
  MCPServerConfig,
  SettingsFile,
  HookConfig,
} from './types/config.js';
export { DEFAULT_CONFIG, DEFAULT_SETTINGS, CONFIG_PATHS } from './types/config.js';

// Utilities
export {
  generateId,
  now,
  expandHome,
  getConfigDir,
  getDataDir,
  getOSName,
  truncate,
  formatDuration,
  safeJsonParse,
  VERSION,
  APP_NAME,
  CLI_NAME,
} from './utils/index.js';
