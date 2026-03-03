/**
 * @free-cli/cli — Package Entry Point
 *
 * Re-exports the primary modules for programmatic use.
 * Most users will interact via the `fcli` binary, but
 * this allows importing as a library if needed.
 */

export { GroqProvider } from './llm/groq.js';
export { chatCommand } from './commands/chat.js';
export { configCommand, configWizard } from './commands/config.js';
export { doctorCommand } from './commands/doctor.js';
export { historyCommand } from './commands/history.js';
export {
  getConfig,
  setConfig,
  getAllConfig,
  getApiKey,
  setApiKey,
  ensureDirectories,
} from './storage/config.js';
export {
  createSession,
  getSession,
  listSessions,
  addMessage,
  getSessionMessages,
} from './storage/sessions.js';
export { renderMarkdown, renderCodeBlock } from './ui/renderer.js';
export { logger } from './utils/logger.js';
export { FreeCLIError, AuthenticationError, APIError, ToolExecutionError } from './utils/errors.js';
