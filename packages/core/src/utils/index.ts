/**
 * @free-cli/core — Shared Utilities
 *
 * Common utility functions used across packages.
 */

import { randomUUID } from 'node:crypto';
import { homedir, platform, type } from 'node:os';
import { join } from 'node:path';

/**
 * Generate a UUID v4 string.
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Get the current timestamp in milliseconds.
 */
export function now(): number {
  return Date.now();
}

/**
 * Resolve a path that may contain ~ to the user's home directory.
 */
export function expandHome(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return join(homedir(), path.slice(1));
  }
  return path;
}

/**
 * Get the Free-CLI config directory path for the current OS.
 */
export function getConfigDir(): string {
  const os = platform();
  if (os === 'win32') {
    const appData = process.env['APPDATA'] || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'free-cli');
  }
  return join(homedir(), '.free-cli');
}

/**
 * Get the Free-CLI data directory path.
 */
export function getDataDir(): string {
  return join(getConfigDir(), 'data');
}

/**
 * Get a human-readable OS name.
 */
export function getOSName(): string {
  const os = platform();
  const osType = type();
  switch (os) {
    case 'darwin':
      return `macOS (${osType})`;
    case 'win32':
      return `Windows (${osType})`;
    case 'linux':
      return `Linux (${osType})`;
    default:
      return `${os} (${osType})`;
  }
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Safely parse JSON, returning undefined on failure.
 */
export function safeJsonParse<T>(str: string): T | undefined {
  try {
    return JSON.parse(str) as T;
  } catch {
    return undefined;
  }
}

/** Application version — injected at build time or read from package.json */
export const VERSION = '0.1.0';

/** Application name */
export const APP_NAME = 'free-cli';

/** CLI command name */
export const CLI_NAME = 'fcli';
