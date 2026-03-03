/**
 * @free-cli/cli — StreamingText Component
 *
 * Renders streaming LLM output in the terminal.
 * Handles incremental text updates with markdown rendering
 * once the stream is complete.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface StreamingTextProps {
  /** Text accumulated so far */
  content: string;
  /** Whether the stream is still in progress */
  isStreaming: boolean;
  /** Whether to render markdown (applied once streaming finishes) */
  renderMarkdown?: boolean;
}

/**
 * StreamingText — displays AI response text with a cursor while streaming.
 */
export const StreamingText: React.FC<StreamingTextProps> = ({
  content,
  isStreaming,
}) => {
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blink the cursor while streaming
  useEffect(() => {
    if (!isStreaming) {
      setCursorVisible(false);
      return;
    }

    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);

    return () => clearInterval(interval);
  }, [isStreaming]);

  if (!content && isStreaming) {
    return (
      <Box>
        <Text color="gray">Thinking...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>
        {content}
        {isStreaming && cursorVisible ? '▊' : ''}
      </Text>
    </Box>
  );
};
