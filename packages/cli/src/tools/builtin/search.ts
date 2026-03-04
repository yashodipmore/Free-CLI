/**
 * @free-cli/cli — Web Search Tool (Built-in)
 *
 * Searches the web using Tavily API (free tier: 1000 searches/month).
 * Safety level: read-only.
 */

import type { ToolDefinition } from '@free-cli/core';
import { getApiKey } from '../../storage/config.js';

/**
 * Get web search tool definitions.
 */
export function getSearchTools(): ToolDefinition[] {
  return [webSearchTool()];
}

function webSearchTool(): ToolDefinition {
  return {
    name: 'web_search',
    description:
      'Search the web for current information. Returns relevant snippets and URLs. Use this when you need up-to-date information, documentation, or to find solutions to technical problems.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query. Be specific and detailed for best results.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return. Default: 5, Max: 10.',
        },
        search_depth: {
          type: 'string',
          description: '"basic" for fast results or "advanced" for deeper search. Default: "basic".',
        },
      },
      required: ['query'],
    },
    safetyLevel: 'read-only',
    source: 'builtin',
    timeout: 30_000,
    enabled: true,
    execute: async (args) => {
      const apiKey = await getApiKey('tavily');
      if (!apiKey) {
        return 'Web search is not configured. Run `fcli config` and set your Tavily API key to enable web search.';
      }

      const query = String(args['query']);
      const maxResults = Math.min(Number(args['max_results'] ?? 5), 10);
      const searchDepth = String(args['search_depth'] ?? 'basic');

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          search_depth: searchDepth,
          include_answer: true,
          include_raw_content: false,
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        if (response.status === 401) {
          return 'Tavily API key is invalid. Run `fcli config` to update it.';
        }
        throw new Error(`Tavily search failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as TavilyResponse;

      const parts: string[] = [`Search: "${query}"`];

      if (data.answer) {
        parts.push(`\nAnswer: ${data.answer}`);
      }

      if (data.results && data.results.length > 0) {
        parts.push(`\nResults (${data.results.length}):\n`);
        for (const [i, result] of data.results.entries()) {
          parts.push(`${i + 1}. ${result.title}`);
          parts.push(`   URL: ${result.url}`);
          if (result.content) {
            // Truncate long snippets
            const snippet =
              result.content.length > 500
                ? result.content.slice(0, 500) + '...'
                : result.content;
            parts.push(`   ${snippet}`);
          }
          parts.push('');
        }
      } else {
        parts.push('\nNo results found.');
      }

      return parts.join('\n');
    },
  };
}

// ── Tavily API types ───────────────────────────────────────────────

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
  query: string;
}
