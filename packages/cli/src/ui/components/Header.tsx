/**
 * @free-cli/cli — Header Component
 *
 * Renders the beautiful gradient welcome header using Ink.
 */

import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  model: string;
  sessionId?: string;
}

/**
 * Header component — displayed at the top of the chat interface.
 */
export const Header: React.FC<HeaderProps> = ({ model, sessionId }) => {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color="cyan">
          ⚡ Free-CLI
        </Text>
        <Text color="gray"> — Your terminal. Your AI. Groq fast.</Text>
      </Box>
      <Box>
        <Text color="gray">Model: </Text>
        <Text color="cyan">{model}</Text>
        {sessionId && (
          <>
            <Text color="gray"> │ Session: </Text>
            <Text color="yellow">{sessionId.slice(0, 8)}</Text>
          </>
        )}
      </Box>
      <Box>
        <Text color="gray">Type /help for commands, /exit to quit.</Text>
      </Box>
    </Box>
  );
};
