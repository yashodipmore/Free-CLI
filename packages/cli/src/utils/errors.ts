/**
 * @free-cli/cli — Custom Error Classes
 *
 * Structured error hierarchy for consistent error handling
 * across the entire CLI application.
 */

/**
 * Base error class for all Free-CLI errors.
 * Provides a consistent error structure with error codes.
 */
export class FreeCLIError extends Error {
  public readonly code: string;
  public override readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = 'FreeCLIError';
    this.code = code;
    this.cause = cause;
    // Maintains proper stack trace in V8
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Thrown when API key is missing or invalid.
 */
export class AuthenticationError extends FreeCLIError {
  constructor(provider: string, message?: string) {
    super(
      message || `Authentication failed for ${provider}. Run 'fcli config' to set up your API key.`,
      'AUTH_ERROR',
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when an API call fails (network, rate limit, server error).
 */
export class APIError extends FreeCLIError {
  public readonly statusCode?: number;
  public readonly provider: string;

  constructor(provider: string, message: string, statusCode?: number, cause?: Error) {
    super(message, 'API_ERROR', cause);
    this.name = 'APIError';
    this.provider = provider;
    this.statusCode = statusCode;
  }

  /** Check if this is a rate limit error */
  get isRateLimit(): boolean {
    return this.statusCode === 429;
  }
}

/**
 * Thrown when a tool execution fails.
 */
export class ToolExecutionError extends FreeCLIError {
  public readonly toolName: string;

  constructor(toolName: string, message: string, cause?: Error) {
    super(`Tool '${toolName}' failed: ${message}`, 'TOOL_ERROR', cause);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
  }
}

/**
 * Thrown when the user cancels an operation.
 */
export class UserCancelledError extends FreeCLIError {
  constructor(message?: string) {
    super(message || 'Operation cancelled by user.', 'USER_CANCELLED');
    this.name = 'UserCancelledError';
  }
}

/**
 * Thrown when configuration is invalid or missing.
 */
export class ConfigError extends FreeCLIError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}
