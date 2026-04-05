import type { LogEntry, LogLevel, LogStream, LoggerOptions } from './types';
import { formatJSON, formatPretty } from './formatters';
import { getLogFormat, isBrowser, isLocal } from '../environment/env';
import { isRecord, redact } from './redactor';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  error: 3,
  info: 1,
  warn: 2,
};

export class Logger {
  private readonly options: LoggerOptions;
  private stream: LogStream | undefined;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      color: options.color ?? true,
      level: options.level ?? 'info',
      mode: isLocal() ? (options.mode ?? (getLogFormat() === 'json' ? 'json' : 'pretty')) : 'json',
      outputPath: options.outputPath ?? undefined,
      redact: options.redact ?? [],
      rotation: options.rotation ?? undefined,
      timestamp: options.timestamp ?? true,
    };
  }

  public get mode(): 'pretty' | 'json' {
    return this.options.mode;
  }

  async init(): Promise<this> {
    if (isBrowser()) {
      return this;
    }
    if (this.options.outputPath !== undefined) {
      try {
        const { createRotationStream } = await import('./rotation');
        const stream = await createRotationStream(this.options.outputPath, this.options.rotation);
        this.stream = stream;
      } catch (error) {
        globalThis.console.error('Failed to initialize log rotation stream:', error);
      }
    }
    return this;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const levelPriority = LOG_LEVEL_PRIORITY[level];
    const optionLevelPriority = LOG_LEVEL_PRIORITY[this.options.level];

    if (levelPriority < optionLevelPriority) {
      return;
    }

    const redactedMetadata =
      metadata === undefined ? undefined : redact(metadata, this.options.redact);

    const entry: LogEntry = {
      level,
      message,
      metadata: isRecord(redactedMetadata) ? redactedMetadata : undefined,
      timestamp: this.options.timestamp ? new Date().toISOString() : '',
    };

    this.writeToOutputs(entry);
  }

  private writeToOutputs(entry: LogEntry): void {
    if (this.options.mode === 'pretty') {
      globalThis.console.log(formatPretty(entry, this.options.color));
    } else {
      globalThis.console.log(formatJSON(entry));
    }

    if (this.stream !== undefined) {
      const fileEntry =
        this.options.mode === 'pretty' ? formatPretty(entry, false) : formatJSON(entry);
      this.stream.write(`${fileEntry}\n`);
    }
  }

  static async create(options: Partial<LoggerOptions> = {}): Promise<Logger> {
    const logger = new Logger(options);
    await logger.init();
    return logger;
  }
}

export const logger = new Logger();
