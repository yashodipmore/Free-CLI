/**
 * @free-cli/cli — Main Ink TUI App
 *
 * Root component for the Ink-based terminal UI.
 * Re-exports all UI components for convenient access.
 */

export { Header } from './components/Header.js';
export { StatusBar } from './components/StatusBar.js';
export { StreamingText } from './components/StreamingText.js';
export { ChatView } from './components/ChatView.js';
export { renderMarkdown, renderCodeBlock, renderDiff } from './renderer.js';
