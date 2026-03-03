/**
 * @free-cli/cli — Config Storage
 *
 * Manages user configuration using Configstore (cross-platform).
 * API keys are stored securely via keytar (OS keychain).
 * Falls back to configstore if keytar is unavailable.
 */

import Configstore from 'configstore';
import { DEFAULT_CONFIG, getConfigDir, getDataDir } from '@free-cli/core';
import type { UserConfig } from '@free-cli/core';
import { mkdirSync, existsSync } from 'node:fs';
import { logger } from '../utils/logger.js';

/** The configstore instance — lazy initialized */
let store: Configstore | null = null;

/** Service name for keytar credential storage */
const KEYTAR_SERVICE = 'free-cli';

/**
 * Get the Configstore instance, creating it if needed.
 */
function getStore(): Configstore {
  if (!store) {
    store = new Configstore('free-cli', DEFAULT_CONFIG as unknown as Record<string, unknown>, {
      configPath: `${getConfigDir()}/config.json`,
    });
  }
  return store;
}

/**
 * Ensure the config and data directories exist.
 */
export function ensureDirectories(): void {
  const configDir = getConfigDir();
  const dataDir = getDataDir();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
    logger.debug(`Created config directory: ${configDir}`);
  }
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    logger.debug(`Created data directory: ${dataDir}`);
  }
}

/**
 * Get a configuration value.
 */
export function getConfig<K extends keyof UserConfig>(key: K): UserConfig[K] {
  const s = getStore();
  const value = s.get(key) as UserConfig[K] | undefined;
  return value ?? DEFAULT_CONFIG[key];
}

/**
 * Set a configuration value.
 */
export function setConfig<K extends keyof UserConfig>(key: K, value: UserConfig[K]): void {
  const s = getStore();
  s.set(key, value);
}

/**
 * Get the full user config.
 */
export function getAllConfig(): UserConfig {
  const s = getStore();
  return { ...DEFAULT_CONFIG, ...s.all } as UserConfig;
}

/**
 * Reset all configuration to defaults.
 */
export function resetConfig(): void {
  const s = getStore();
  s.clear();
  Object.entries(DEFAULT_CONFIG).forEach(([key, value]) => {
    s.set(key, value);
  });
}

/**
 * Store an API key securely.
 * Attempts keytar (OS keychain) first, falls back to configstore.
 */
export async function setApiKey(provider: string, key: string): Promise<void> {
  try {
    // Try keytar first for secure storage
    const keytar = await import('keytar').catch(() => null);
    if (keytar) {
      await keytar.setPassword(KEYTAR_SERVICE, provider, key);
      logger.debug(`API key for ${provider} stored in OS keychain`);
      return;
    }
  } catch {
    // keytar not available — fall back
  }

  // Fallback: store in configstore (less secure but works everywhere)
  const s = getStore();
  s.set(`keys.${provider}`, key);
  logger.warn(`keytar unavailable — API key stored in config file (less secure)`);
}

/**
 * Retrieve an API key.
 * Checks keytar first, then configstore, then environment variable.
 */
export async function getApiKey(provider: string): Promise<string | null> {
  // 1. Check environment variable first (highest priority)
  const envMap: Record<string, string> = {
    groq: 'GROQ_API_KEY',
    tavily: 'TAVILY_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  };
  const envKey = envMap[provider];
  if (envKey && process.env[envKey]) {
    return process.env[envKey] as string;
  }

  // 2. Try keytar (OS keychain)
  try {
    const keytar = await import('keytar').catch(() => null);
    if (keytar) {
      const value = await keytar.getPassword(KEYTAR_SERVICE, provider);
      if (value) return value;
    }
  } catch {
    // keytar not available
  }

  // 3. Fallback to configstore
  const s = getStore();
  const fallback = s.get(`keys.${provider}`) as string | undefined;
  return fallback || null;
}

/**
 * Check if this is the first run.
 */
export function isFirstRun(): boolean {
  return getConfig('firstRun');
}

/**
 * Mark the first run as completed.
 */
export function markFirstRunComplete(): void {
  setConfig('firstRun', false);
}
