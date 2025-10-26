import { createWriteStream, existsSync, mkdirSync } from 'fs';
import type { WriteStream } from 'fs';
import { join } from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type LogMetadata = Record<string, unknown>;

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
};

const isBrowser = typeof window !== 'undefined';

class StructuredLogger {
  private stream: WriteStream | null = null;
  private readonly context: LogMetadata;

  constructor(context: LogMetadata = {}) {
    this.context = context;
  }

  info(message: string, metadata?: LogMetadata): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: LogMetadata): void {
    this.log('error', message, metadata);
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.log('debug', message, metadata);
  }

  child(metadata: LogMetadata): StructuredLogger {
    return new StructuredLogger({ ...this.context, ...metadata });
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    const mergedMetadata: LogMetadata =
      Object.keys(this.context).length === 0 && !metadata
        ? {}
        : { ...this.context, ...(metadata ?? {}) };

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(Object.keys(mergedMetadata).length > 0 ? { metadata: mergedMetadata } : {}),
    };

    this.writeToConsole(entry);
    this.writeToFile(entry);
  }

  private writeToConsole(entry: LogEntry): void {
    const consoleMethod =
      entry.level === 'error'
        ? console.error
        : entry.level === 'warn'
          ? console.warn
          : console.log;

    consoleMethod(this.formatConsoleMessage(entry));
  }

  private writeToFile(entry: LogEntry): void {
    if (isBrowser) return;
    const stream = this.ensureStream();
    if (!stream) return;
    stream.write(JSON.stringify(entry) + '\n');
  }

  private ensureStream(): WriteStream | null {
    if (isBrowser) return null;
    if (this.stream) return this.stream;

    try {
      const logsDir = join(process.cwd(), 'backtest', 'logs');
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }
      this.stream = createWriteStream(join(logsDir, 'trading.log'), {
        flags: 'a',
      });
    } catch (error) {
      console.error('Failed to initialize structured logger stream:', error);
      this.stream = null;
    }

    return this.stream;
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const base = `${entry.timestamp} ${entry.level.toUpperCase()}: ${entry.message}`;
    if (!entry.metadata || Object.keys(entry.metadata).length === 0) {
      return base;
    }
    return `${base} ${JSON.stringify(entry.metadata)}`;
  }
}

const globalForLogger = globalThis as unknown as {
  structuredLogger?: StructuredLogger;
};

if (!globalForLogger.structuredLogger) {
  globalForLogger.structuredLogger = new StructuredLogger();
}

export const logger = globalForLogger.structuredLogger;
export { StructuredLogger };
