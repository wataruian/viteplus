import { type AnyValueMap, SeverityNumber, logs } from '@opentelemetry/api-logs';
import type { LogEntry, LogLevel, LogStream, LoggerOptions } from '../types/log';
import { formatJSON, formatPretty } from './formatters';
import { getLogFormat, isBrowser, isLocal } from '../environment/env';
import { isRecord } from '../validators/validate';
import { redact } from './redactor';

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

const isAnyValueMap = (value: unknown): value is AnyValueMap =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

class Logger {
  private readonly options: LoggerOptions;
  private stream: LogStream | undefined;
  private readonly otelLogger = logs.getLogger('application');

  public constructor(options: Partial<LoggerOptions> = {}) {
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

  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const levelPriority = logLevelPriority[level];
    const optionLevelPriority = logLevelPriority[this.options.level];

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

  private writeToOtel(entry: LogEntry): void {
    const metadata = entry.metadata ?? {};

    this.otelLogger.emit({
      attributes: {
        logger: 'application',
        metadata: isAnyValueMap(metadata) ? metadata : {},
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

export { isAnyValueMap, logLevelPriority, Logger, logger };
