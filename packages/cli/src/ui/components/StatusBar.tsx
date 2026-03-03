/**
 * @free-cli/cli — StatusBar Component
 *
 * Displays session status, token usage, and model info at the bottom.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { TokenUsage } from '@free-cli/core';

interface StatusBarProps {
  model: string;
  tokens?: TokenUsage;
  messageCount: number;
  status: 'idle' | 'thinking' | 'streaming' | 'error';
}

/**
 * StatusBar — bottom bar showing session stats.
 */
export const StatusBar: React.FC<StatusBarProps> = ({ model, tokens, messageCount, status }) => {
  const statusColor =
    status === 'thinking'
      ? 'yellow'
      : status === 'streaming'
        ? 'green'
        : status === 'error'
          ? 'red'
          : 'gray';

  const statusIcon =
    status === 'thinking'
      ? '◉'
      : status === 'streaming'
        ? '◉'
        : status === 'error'
          ? '✗'
          : '○';

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Box flexGrow={1}>
        <Text color={statusColor}>
          {statusIcon} {status}
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text color="gray">Model: </Text>
        <Text color="cyan">{model}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color="gray">Messages: </Text>
        <Text>{messageCount}</Text>
      </Box>
      {tokens && (
        <Box marginLeft={2}>
          <Text color="gray">Tokens: </Text>
          <Text color="yellow">{tokens.totalTokens.toLocaleString()}</Text>
        </Box>
      )}
    </Box>
  );
};
