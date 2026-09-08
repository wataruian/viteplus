import * as faroSdk from '@grafana/faro-web-sdk';
import { SeverityNumber, logs } from '@opentelemetry/api-logs';

import { getLogFormat, getLogLevel, isBrowser, isLocal } from '../environment/env';
import { isRecord } from '../validators/validate';
import { getSessionId } from './context';
import { type LogEntry, type LogLevel, type LogMode, formatJSON, formatPretty } from './formatters';
import { redact } from './redactor';

const isFaroLogLevel = (level: unknown): level is faroSdk.LogLevel => typeof level === 'string';

interface LoggerOptions {
  color: boolean;
  level: LogLevel;
  mode: LogMode;
  redact: string[];
  silent?: boolean;
  timestamp: boolean;
}

const logLevelPriority: Record<LogLevel, number> = {
  debug: 0,
  error: 3,
  info: 1,
  warn: 2,
};

const faroLogLevel: Record<LogLevel, faroSdk.LogLevel> = {
  debug: faroSdk.LogLevel.DEBUG,
  error: faroSdk.LogLevel.ERROR,
  info: faroSdk.LogLevel.INFO,
  warn: faroSdk.LogLevel.WARN,
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
      redact: options.redact ?? [],
      timestamp: options.timestamp ?? true,
    };
  }

  public get mode(): 'pretty' | 'json' {
    return this.options.mode;
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
      ...(Object.keys(resolvedMetadata).length > 0 ? { context: resolvedMetadata } : {}),
      timestamp: this.options.timestamp ? new Date().toISOString() : '',
    };

    this.writeToOutputs(entry);
  }

  private writeToOtel(entry: LogEntry): void {
    if (isBrowser() || this.silent) {
      return;
    }

    const context = entry.context ?? {};

    this.otelLogger.emit({
      attributes: {
        context: Object.keys(context).length > 0 ? JSON.stringify(context) : undefined,
        logger: 'application',
        timestamp: entry.timestamp,
      },
      body: JSON.stringify(entry),
      severityNumber: otelSeverity[entry.level],
      severityText: entry.level.toUpperCase(),
    });
  }

  private writeToFaro(entry: LogEntry): void {
    if (!isBrowser() || this.silent) {
      return;
    }

    const options: faroSdk.PushLogOptions = { level: faroLogLevel[entry.level] };

    faroSdk.faro.api.pushLog([JSON.stringify(entry)], options);
  }

  private writeToOutputs(entry: LogEntry): void {
    try {
      this.writeToFaro(entry);
    } catch {
      // Skip Faro logging if it fails
    }

    try {
      this.writeToOtel(entry);
    } catch {
      // Skip OpenTelemetry logging if it fails
    }

    if (this.options.mode === 'pretty') {
      globalThis.console.log(formatPretty(entry, this.options.color));
    } else {
      globalThis.console.log(formatJSON(entry));
    }
  }
}

const logger = new Logger();

export { Logger, faroLogLevel, isFaroLogLevel, logLevelPriority, logger, otelSeverity };
export type { LoggerOptions };
