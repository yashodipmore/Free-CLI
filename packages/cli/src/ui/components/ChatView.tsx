/**
 * @free-cli/cli — ChatView Component
 *
 * Renders the full chat message history in the terminal.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ConversationMessage } from '@free-cli/core';

interface ChatViewProps {
  messages: ConversationMessage[];
  /** Maximum messages to display (most recent) */
  maxVisible?: number;
}

/**
 * ChatView — displays conversation history with role-based styling.
 */
export const ChatView: React.FC<ChatViewProps> = ({ messages, maxVisible = 20 }) => {
  // Filter out system messages and show only recent
  const visible = messages
    .filter((m) => m.role !== 'system')
    .slice(-maxVisible);

  return (
    <Box flexDirection="column" paddingX={1}>
      {visible.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </Box>
  );
};

interface MessageBubbleProps {
  message: ConversationMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  const roleLabel = isUser ? '❯ You' : isTool ? '🔧 Tool' : '⚡ AI';
  const roleColor = isUser ? 'green' : isTool ? 'yellow' : 'cyan';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={roleColor}>
        {roleLabel}
      </Text>
      <Box paddingLeft={2}>
        <Text wrap="wrap">{message.content}</Text>
      </Box>
    </Box>
  );
};
