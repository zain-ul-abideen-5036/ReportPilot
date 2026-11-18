/**
 * Structured JSON logs, one object per line, so GitHub Actions output can
 * be searched and a log drain can parse it without guessing.
 */
type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): Logger;
}

export function createLogger(base: Record<string, unknown> = {}, sink: (line: string) => void = (l) => process.stdout.write(`${l}\n`)): Logger {
  const write = (level: Level, msg: string, meta?: Record<string, unknown>) => {
    if (level === "debug" && !process.env.DEBUG) return;
    sink(JSON.stringify({ t: new Date().toISOString(), level, msg, ...base, ...meta }));
  };
  return {
    debug: (m, x) => write("debug", m, x),
    info: (m, x) => write("info", m, x),
    warn: (m, x) => write("warn", m, x),
    error: (m, x) => write("error", m, x),
    child: (meta) => createLogger({ ...base, ...meta }, sink),
  };
}

export const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {}, child: () => silentLogger };
