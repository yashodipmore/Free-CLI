/**
 * @free-cli/cli — Git Tools (Built-in)
 *
 * Git status, diff, log, and commit tools for repository awareness.
 */

import { spawn } from 'node:child_process';
import type { ToolDefinition } from '@free-cli/core';

/**
 * Get all git tool definitions.
 */
export function getGitTools(cwd: string): ToolDefinition[] {
  return [gitStatusTool(cwd), gitDiffTool(cwd), gitLogTool(cwd), gitCommitTool(cwd)];
}

function runGit(args: string[], cwd: string, timeout = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Git command timed out'));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`git ${args.join(' ')} failed (exit ${code}): ${stderr.trim()}`));
        return;
      }
      resolve(stdout.trim());
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to run git: ${err.message}. Is git installed?`));
    });
  });
}

// ── git_status ─────────────────────────────────────────────────────

function gitStatusTool(cwd: string): ToolDefinition {
  return {
    name: 'git_status',
    description:
      'Get the current git repository status including branch, staged/unstaged changes, and untracked files.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    safetyLevel: 'read-only',
    source: 'builtin',
    timeout: 15_000,
    enabled: true,
    execute: async () => {
      const [branch, status, stash] = await Promise.all([
        runGit(['branch', '--show-current'], cwd).catch(() => '(detached HEAD)'),
        runGit(['status', '--porcelain=v2', '--branch'], cwd),
        runGit(['stash', 'list', '--oneline'], cwd).catch(() => ''),
      ]);

      const parts: string[] = [`Branch: ${branch}`];

      // Parse porcelain v2 output
      const lines = status.split('\n');
      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      for (const line of lines) {
        if (line.startsWith('1 ') || line.startsWith('2 ')) {
          // Changed entries
          const xy = line.split(' ')[1];
          if (xy) {
            const x = xy[0]; // Index status
            const y = xy[1]; // Worktree status
            // Extract filename (last field)
            const parts2 = line.split('\t');
            const filename = parts2[parts2.length - 1] ?? line.split(' ').pop() ?? '';
            if (x !== '.' && x !== '?') staged.push(`  ${x} ${filename}`);
            if (y !== '.' && y !== '?') unstaged.push(`  ${y} ${filename}`);
          }
        } else if (line.startsWith('? ')) {
          untracked.push(`  ${line.slice(2)}`);
        }
      }

      if (staged.length > 0) parts.push(`\nStaged (${staged.length}):\n${staged.join('\n')}`);
      if (unstaged.length > 0)
        parts.push(`\nUnstaged (${unstaged.length}):\n${unstaged.join('\n')}`);
      if (untracked.length > 0)
        parts.push(`\nUntracked (${untracked.length}):\n${untracked.join('\n')}`);
      if (staged.length === 0 && unstaged.length === 0 && untracked.length === 0) {
        parts.push('\nWorking tree clean.');
      }
      if (stash) {
        parts.push(`\nStash:\n${stash}`);
      }

      return parts.join('\n');
    },
  };
}

// ── git_diff ───────────────────────────────────────────────────────

function gitDiffTool(cwd: string): ToolDefinition {
  return {
    name: 'git_diff',
    description:
      'Show git diff output. By default shows unstaged changes. Can show staged changes or diff between commits/branches.',
    parameters: {
      type: 'object',
      properties: {
        staged: {
          type: 'boolean',
          description: 'If true, show staged (--cached) changes. Default: false.',
        },
        path: {
          type: 'string',
          description: 'Optional: limit diff to a specific file or directory path.',
        },
        ref: {
          type: 'string',
          description:
            'Optional: diff against a specific ref (branch, commit, tag). E.g. "HEAD~3" or "main".',
        },
      },
      required: [],
    },
    safetyLevel: 'read-only',
    source: 'builtin',
    timeout: 15_000,
    enabled: true,
    execute: async (args) => {
      const gitArgs = ['diff', '--stat', '--patch'];

      if (args['staged']) gitArgs.push('--cached');
      if (args['ref']) gitArgs.push(String(args['ref']));
      gitArgs.push('--');
      if (args['path']) gitArgs.push(String(args['path']));

      const diff = await runGit(gitArgs, cwd);
      if (!diff) return 'No differences found.';

      // Truncate very large diffs
      if (diff.length > 50_000) {
        return diff.slice(0, 50_000) + '\n\n... (diff truncated at 50KB)';
      }
      return diff;
    },
  };
}

// ── git_log ────────────────────────────────────────────────────────

function gitLogTool(cwd: string): ToolDefinition {
  return {
    name: 'git_log',
    description: 'Show recent git commit history. Returns commit hashes, authors, dates, and messages.',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Number of commits to show. Default: 10, Max: 50.',
        },
        path: {
          type: 'string',
          description: 'Optional: show commits that changed a specific file or directory.',
        },
        oneline: {
          type: 'boolean',
          description: 'If true, show compact one-line format. Default: false.',
        },
      },
      required: [],
    },
    safetyLevel: 'read-only',
    source: 'builtin',
    timeout: 15_000,
    enabled: true,
    execute: async (args) => {
      const count = Math.min(Number(args['count'] ?? 10), 50);
      const oneline = Boolean(args['oneline']);

      const gitArgs = ['log', `-${count}`];

      if (oneline) {
        gitArgs.push('--oneline', '--decorate');
      } else {
        gitArgs.push('--format=%H%n%an <%ae>%n%ai%n%s%n%b%n---');
      }

      if (args['path']) {
        gitArgs.push('--', String(args['path']));
      }

      const log = await runGit(gitArgs, cwd);
      return log || 'No commits found.';
    },
  };
}

// ── git_commit ─────────────────────────────────────────────────────

function gitCommitTool(cwd: string): ToolDefinition {
  return {
    name: 'git_commit',
    description:
      'Stage files and create a git commit. Can stage specific files or all changes.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The commit message.',
        },
        files: {
          type: 'array',
          description:
            'Files to stage before committing. Use ["."] to stage all changes. If omitted, commits already-staged files.',
        },
      },
      required: ['message'],
    },
    safetyLevel: 'safe-write',
    source: 'builtin',
    timeout: 30_000,
    enabled: true,
    execute: async (args) => {
      const message = String(args['message']);
      const files = args['files'] as string[] | undefined;

      // Stage files if specified
      if (files && files.length > 0) {
        await runGit(['add', ...files], cwd);
      }

      // Check if there's anything to commit
      const staged = await runGit(['diff', '--cached', '--name-only'], cwd).catch(() => '');
      if (!staged.trim()) {
        return 'Nothing to commit — no staged changes.';
      }

      // Commit
      await runGit(['commit', '-m', message], cwd);

      // Get commit info
      const hash = await runGit(['rev-parse', '--short', 'HEAD'], cwd);
      const stagedFiles = staged.trim().split('\n');

      return `Committed ${hash}: "${message}"\nFiles (${stagedFiles.length}): ${stagedFiles.join(', ')}`;
    },
  };
}
