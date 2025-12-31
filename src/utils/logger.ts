type LogLevel = "info" | "warn" | "error" | "debug";

const log = (level: LogLevel, message: string, meta?: unknown) => {
  const prefix = `[${level.toUpperCase()}]`;
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console.log(prefix, message, meta);
  } else {
    // eslint-disable-next-line no-console
    console.log(prefix, message);
  }
};

export const logger = {
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
  debug: (message: string, meta?: unknown) => log("debug", message, meta),
};



