/**
 * @free-cli/core — Config Types
 *
 * Type definitions for the configuration system,
 * including user preferences, project config, and MCP settings.
 */

import type { ApprovalMode } from './agent.js';

/** User-level configuration stored in ~/.free-cli/config.json */
export interface UserConfig {
  /** Default LLM model ID */
  defaultModel: string;
  /** Approval mode for destructive tool operations */
  approvalMode: ApprovalMode;
  /** Terminal theme */
  theme: 'dark' | 'light' | 'system';
  /** Whether the web dashboard is enabled */
  dashboardEnabled: boolean;
  /** Port for the web dashboard */
  dashboardPort: number;
  /** Maximum ReAct loop iterations */
  maxIterations: number;
  /** Maximum context window tokens to use */
  contextWindowTokens: number;
  /** Whether anonymous telemetry is enabled */
  telemetry: boolean;
  /** Whether this is the first run (triggers setup wizard) */
  firstRun: boolean;
}

/** Default configuration values */
export const DEFAULT_CONFIG: UserConfig = {
  defaultModel: 'llama-3.3-70b-versatile',
  approvalMode: 'ask',
  theme: 'dark',
  dashboardEnabled: false,
  dashboardPort: 3001,
  maxIterations: 20,
  contextWindowTokens: 100_000,
  telemetry: false,
  firstRun: true,
};

/** MCP server configuration entry */
export interface MCPServerConfig {
  /** Command to spawn the MCP server */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables to pass */
  env?: Record<string, string>;
  /** Transport type */
  transport: 'stdio' | 'sse' | 'http';
  /** URL for SSE/HTTP transports */
  url?: string;
  /** Whether this server is enabled */
  enabled: boolean;
}

/** Settings file (~/.free-cli/settings.json) */
export interface SettingsFile {
  /** MCP server configurations */
  mcpServers: Record<string, MCPServerConfig>;
  /** MCP global settings */
  mcp: {
    /** Default timeout for MCP calls in milliseconds */
    timeout: number;
    /** Max retries for failed MCP calls */
    maxRetries: number;
  };
  /** Lifecycle hooks */
  hooks?: Record<string, HookConfig>;
}

/** Lifecycle hook configuration */
export interface HookConfig {
  /** Shell command or path to script */
  command: string;
  /** Timeout in milliseconds */
  timeout: number;
  /** Whether to block execution until hook completes */
  blocking: boolean;
}

/** Default settings */
export const DEFAULT_SETTINGS: SettingsFile = {
  mcpServers: {},
  mcp: {
    timeout: 30_000,
    maxRetries: 3,
  },
};

/** Config directory paths */
export const CONFIG_PATHS = {
  /** Base config directory */
  configDir: '~/.free-cli',
  /** User config file */
  configFile: '~/.free-cli/config.json',
  /** Settings file (MCP, hooks) */
  settingsFile: '~/.free-cli/settings.json',
  /** Data directory */
  dataDir: '~/.free-cli/data',
  /** SQLite sessions database */
  sessionsDb: '~/.free-cli/data/sessions.db',
  /** Audit log */
  auditLog: '~/.free-cli/data/audit.log',
} as const;
