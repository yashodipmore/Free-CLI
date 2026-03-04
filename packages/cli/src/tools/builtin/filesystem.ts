/**
 * @free-cli/cli — Filesystem Tool (Built-in)
 *
 * Read, write, edit, and list files and directories.
 * Provides the AI with full filesystem access within the working directory.
 */

import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import type { ToolDefinition } from '@free-cli/core';

/**
 * Get all filesystem tool definitions.
 */
export function getFilesystemTools(cwd: string): ToolDefinition[] {
  return [readFileTool(cwd), writeFileTool(cwd), editFileTool(cwd), listDirectoryTool(cwd)];
}

function resolvePath(cwd: string, filePath: string): string {
  return resolve(cwd, filePath);
}

// ── read_file ──────────────────────────────────────────────────────

function readFileTool(cwd: string): ToolDefinition {
  return {
    name: 'read_file',
    description:
      'Read the contents of a file. Returns the full text content. Use this to examine source code, config files, documentation, etc.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative or absolute path to the file to read.',
        },
        start_line: {
          type: 'number',
          description: 'Optional: first line number to read (1-based). Omit to read from start.',
        },
        end_line: {
          type: 'number',
          description: 'Optional: last line number to read (1-based, inclusive). Omit to read to end.',
        },
      },
      required: ['path'],
    },
    safetyLevel: 'read-only',
    source: 'builtin',
    timeout: 10_000,
    enabled: true,
    execute: async (args) => {
      const filePath = resolvePath(cwd, String(args['path']));
      const content = await readFile(filePath, 'utf-8');

      const startLine = args['start_line'] as number | undefined;
      const endLine = args['end_line'] as number | undefined;

      if (startLine || endLine) {
        const lines = content.split('\n');
        const start = Math.max(1, startLine ?? 1) - 1;
        const end = Math.min(lines.length, endLine ?? lines.length);
        const slice = lines.slice(start, end);
        return `File: ${relative(cwd, filePath)} (lines ${start + 1}-${end} of ${lines.length})\n\n${slice.join('\n')}`;
      }

      const lineCount = content.split('\n').length;
      return `File: ${relative(cwd, filePath)} (${lineCount} lines)\n\n${content}`;
    },
  };
}

// ── write_file ─────────────────────────────────────────────────────

function writeFileTool(cwd: string): ToolDefinition {
  return {
    name: 'write_file',
    description:
      'Create a new file or completely overwrite an existing file with the given content. For partial edits, use edit_file instead.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative or absolute path to the file to write.',
        },
        content: {
          type: 'string',
          description: 'The complete file content to write.',
        },
      },
      required: ['path', 'content'],
    },
    safetyLevel: 'safe-write',
    source: 'builtin',
    timeout: 10_000,
    enabled: true,
    execute: async (args) => {
      const filePath = resolvePath(cwd, String(args['path']));
      const content = String(args['content']);
      const existed = existsSync(filePath);

      // Ensure parent directory exists
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      await writeFile(filePath, content, 'utf-8');

      const lineCount = content.split('\n').length;
      return existed
        ? `File overwritten: ${relative(cwd, filePath)} (${lineCount} lines)`
        : `File created: ${relative(cwd, filePath)} (${lineCount} lines)`;
    },
  };
}

// ── edit_file ──────────────────────────────────────────────────────

function editFileTool(cwd: string): ToolDefinition {
  return {
    name: 'edit_file',
    description:
      'Edit an existing file by replacing an exact string with a new string. The old_string must match exactly (including whitespace). Use this for surgical edits to existing files.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative or absolute path to the file to edit.',
        },
        old_string: {
          type: 'string',
          description: 'The exact text to find and replace. Must match exactly.',
        },
        new_string: {
          type: 'string',
          description: 'The replacement text.',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
    safetyLevel: 'safe-write',
    source: 'builtin',
    timeout: 10_000,
    enabled: true,
    execute: async (args) => {
      const filePath = resolvePath(cwd, String(args['path']));
      const oldStr = String(args['old_string']);
      const newStr = String(args['new_string']);

      const content = await readFile(filePath, 'utf-8');

      const occurrences = content.split(oldStr).length - 1;
      if (occurrences === 0) {
        throw new Error(
          `old_string not found in ${relative(cwd, filePath)}. Make sure it matches exactly including whitespace.`,
        );
      }
      if (occurrences > 1) {
        throw new Error(
          `old_string found ${occurrences} times in ${relative(cwd, filePath)}. It must be unique — add more context lines.`,
        );
      }

      const newContent = content.replace(oldStr, newStr);
      await writeFile(filePath, newContent, 'utf-8');

      const oldLines = oldStr.split('\n').length;
      const newLines = newStr.split('\n').length;
      return `File edited: ${relative(cwd, filePath)} (replaced ${oldLines} lines with ${newLines} lines)`;
    },
  };
}

// ── list_directory ─────────────────────────────────────────────────

function listDirectoryTool(cwd: string): ToolDefinition {
  return {
    name: 'list_directory',
    description:
      'List the contents of a directory. Returns file and folder names with type indicators. Useful for understanding project structure.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative or absolute path to the directory. Defaults to current working directory.',
        },
        recursive: {
          type: 'boolean',
          description: 'If true, list recursively up to 3 levels deep. Default: false.',
        },
      },
      required: [],
    },
    safetyLevel: 'read-only',
    source: 'builtin',
    timeout: 10_000,
    enabled: true,
    execute: async (args) => {
      const dirPath = resolvePath(cwd, String(args['path'] ?? '.'));
      const recursive = Boolean(args['recursive']);

      const entries = await listDir(dirPath, cwd, recursive ? 3 : 1, 0);
      return `Directory: ${relative(cwd, dirPath) || '.'}\n\n${entries.join('\n')}`;
    },
  };
}

async function listDir(
  dirPath: string,
  cwd: string,
  maxDepth: number,
  currentDepth: number,
): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];

  const entries = await readdir(dirPath, { withFileTypes: true });
  const lines: string[] = [];
  const indent = '  '.repeat(currentDepth);

  // Sort: directories first, then files
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    // Skip hidden and common ignore dirs
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

    if (entry.isDirectory()) {
      lines.push(`${indent}📁 ${entry.name}/`);
      if (currentDepth < maxDepth - 1) {
        const subLines = await listDir(
          join(dirPath, entry.name),
          cwd,
          maxDepth,
          currentDepth + 1,
        );
        lines.push(...subLines);
      }
    } else {
      const fileStat = await stat(join(dirPath, entry.name)).catch(() => null);
      const size = fileStat ? formatSize(fileStat.size) : '';
      lines.push(`${indent}📄 ${entry.name} ${size}`);
    }
  }

  return lines;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `(${bytes}B)`;
  if (bytes < 1024 * 1024) return `(${(bytes / 1024).toFixed(1)}KB)`;
  return `(${(bytes / (1024 * 1024)).toFixed(1)}MB)`;
}
