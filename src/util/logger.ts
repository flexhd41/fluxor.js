/**
 * Logger interface used throughout Fluxer.js.
 * Consumers can pass any object that satisfies this shape (e.g. console, pino, winston).
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Default no-op logger — silences all output. */
export const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

/** Simple console-based logger with prefixed output. */
export function createConsoleLogger(level: "debug" | "info" | "warn" | "error" = "info"): Logger {
  const levels = ["debug", "info", "warn", "error"] as const;
  const minIndex = levels.indexOf(level);

  const shouldLog = (l: typeof levels[number]) => levels.indexOf(l) >= minIndex;

  return {
    debug(msg, ...args) {
      if (shouldLog("debug")) console.debug(`[Fluxor][DEBUG] ${msg}`, ...args);
    },
    info(msg, ...args) {
      if (shouldLog("info")) console.info(`[Fluxor][INFO]  ${msg}`, ...args);
    },
    warn(msg, ...args) {
      if (shouldLog("warn")) console.warn(`[Fluxor][WARN]  ${msg}`, ...args);
    },
    error(msg, ...args) {
      if (shouldLog("error")) console.error(`[Fluxor][ERROR] ${msg}`, ...args);
    },
  };
}
