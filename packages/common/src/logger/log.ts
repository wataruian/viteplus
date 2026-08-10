import { type LogEntry, type LogLevel, type LogMode, formatJSON, formatPretty } from './formatters';
import type { LogStream, RotationOptions } from './rotation';
import { SeverityNumber, logs } from '@opentelemetry/api-logs';
import { getLogFormat, getLogLevel, isBrowser, isLocal } from '../environment/env';
import { getSessionId } from './context';
import { isRecord } from '../validators/validate';
import { redact } from './redactor';

interface LoggerOptions {
  color: boolean;
  level: LogLevel;
  mode: LogMode;
  outputPath?: string | undefined;
  redact: string[];
  rotation?: RotationOptions | undefined;
  silent?: boolean;
  timestamp: boolean;
}

const logLevelPriority: Record<LogLevel, number> = {
  debug: 0,
  error: 3,
  info: 1,
  warn: 2,
};

const otelSeverity: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  error: SeverityNumber.ERROR,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
};

class Logger {
  private readonly options: LoggerOptions;
  private readonly silent: boolean;
  private stream: LogStream | undefined;
  private readonly otelLogger = logs.getLogger('application');

  public constructor(options: Partial<LoggerOptions> = {}) {
    const rawLogLevel = getLogLevel();
    this.silent = options.silent ?? rawLogLevel === 'silent';
    const defaultLogLevel: LogLevel =
      rawLogLevel === 'debug' ||
      rawLogLevel === 'info' ||
      rawLogLevel === 'warn' ||
      rawLogLevel === 'error'
        ? rawLogLevel
        : 'info';

    this.options = {
      color: options.color ?? true,
      level: options.level ?? defaultLogLevel,
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

  public async init(): Promise<this> {
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

  public debug(message: string, metadata?: Record<string, unknown> | object): void {
    this.log('debug', message, metadata);
  }

  public info(message: string, metadata?: Record<string, unknown> | object): void {
    this.log('info', message, metadata);
  }

  public warn(message: string, metadata?: Record<string, unknown> | object): void {
    this.log('warn', message, metadata);
  }

  public error(message: string, metadata?: Record<string, unknown> | object): void {
    this.log('error', message, metadata);
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown> | object): void {
    if (this.silent) {
      return;
    }

    const levelPriority = logLevelPriority[level];
    const optionLevelPriority = logLevelPriority[this.options.level];

    if (levelPriority < optionLevelPriority) {
      return;
    }

    const redactedMetadata =
      metadata === undefined ? undefined : redact(metadata, this.options.redact);

    const sessionId = getSessionId();

    const resolvedMetadata = {
      ...(isRecord(redactedMetadata) ? redactedMetadata : {}),
      ...(sessionId === 'no-id' ? {} : { sessionId }),
    };

    const entry: LogEntry = {
      level,
      message,
      ...(Object.keys(resolvedMetadata).length > 0 ? { metadata: resolvedMetadata } : {}),
      timestamp: this.options.timestamp ? new Date().toISOString() : '',
    };

    this.writeToOutputs(entry);
  }

  private writeToOtel(entry: LogEntry): void {
    const metadata = entry.metadata ?? {};

    this.otelLogger.emit({
      attributes: {
        logger: 'application',
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined,
        timestamp: entry.timestamp,
      },
      body: JSON.stringify(entry),
      severityNumber: otelSeverity[entry.level],
      severityText: entry.level.toUpperCase(),
    });
  }

  private writeToOutputs(entry: LogEntry): void {
    try {
      this.writeToOtel(entry);
    } catch {
      // Skip OpenTelemetry logging if it fails`
    }

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

  public static async create(options: Partial<LoggerOptions> = {}): Promise<Logger> {
    const logger = new Logger(options);
    await logger.init();
    return logger;
  }
}

const logger = new Logger();

export type { LoggerOptions };
export { logLevelPriority, otelSeverity, Logger, logger };
