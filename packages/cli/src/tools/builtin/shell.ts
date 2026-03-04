/**
 * @free-cli/cli — Shell Tool (Built-in)
 *
 * Execute shell commands in the user's terminal.
 * Safety level: destructive — always requires approval in ask/strict mode.
 */

import { spawn } from 'node:child_process';
import { relative } from 'node:path';
import type { ToolDefinition } from '@free-cli/core';

/**
 * Get shell tool definitions.
 */
export function getShellTools(cwd: string): ToolDefinition[] {
  return [shellExecuteTool(cwd)];
}

function shellExecuteTool(cwd: string): ToolDefinition {
  return {
    name: 'shell_execute',
    description: `Execute a shell command in bash. Returns stdout, stderr, and exit code. Use this for running build commands, installing packages, running tests, searching with grep/find/ripgrep, or any other terminal command. The working directory is: ${cwd}`,
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute. Supports pipes, redirects, and chaining with && or ||.',
        },
        working_directory: {
          type: 'string',
          description: 'Optional: working directory for the command. Defaults to project root.',
        },
        timeout_ms: {
          type: 'number',
          description: 'Optional: timeout in milliseconds. Default: 30000 (30s). Max: 300000 (5min).',
        },
      },
      required: ['command'],
    },
    safetyLevel: 'destructive',
    source: 'builtin',
    timeout: 300_000, // 5 min max
    enabled: true,
    execute: async (args) => {
      const command = String(args['command']);
      const workDir = args['working_directory'] ? String(args['working_directory']) : cwd;
      const timeout = Math.min(Number(args['timeout_ms'] ?? 30_000), 300_000);

      return executeShellCommand(command, workDir, timeout, cwd);
    },
  };
}

function executeShellCommand(
  command: string,
  workDir: string,
  timeout: number,
  cwd: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', ['-c', command], {
      cwd: workDir,
      env: { ...process.env, FORCE_COLOR: '0' }, // No color codes in captured output
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Limit output size to prevent memory issues (1MB each)
    const MAX_OUTPUT = 1024 * 1024;

    proc.stdout.on('data', (data: Buffer) => {
      if (stdout.length < MAX_OUTPUT) {
        stdout += data.toString();
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      if (stderr.length < MAX_OUTPUT) {
        stderr += data.toString();
      }
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 5_000);
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);

      // Truncate output if needed
      if (stdout.length >= MAX_OUTPUT) {
        stdout = stdout.slice(0, MAX_OUTPUT) + '\n\n... (output truncated at 1MB)';
      }
      if (stderr.length >= MAX_OUTPUT) {
        stderr = stderr.slice(0, MAX_OUTPUT) + '\n\n... (output truncated at 1MB)';
      }

      const relDir = relative(cwd, workDir) || '.';
      const parts: string[] = [
        `Command: ${command}`,
        `Directory: ${relDir}`,
        `Exit code: ${killed ? 'TIMEOUT' : code}`,
      ];

      if (stdout.trim()) {
        parts.push(`\nSTDOUT:\n${stdout.trim()}`);
      }
      if (stderr.trim()) {
        parts.push(`\nSTDERR:\n${stderr.trim()}`);
      }

      if (killed) {
        parts.push(`\n⚠ Command timed out after ${timeout}ms and was terminated.`);
      }

      resolve(parts.join('\n'));
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to execute command: ${err.message}`));
    });
  });
}
