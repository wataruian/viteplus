import { SeverityNumber, logs } from '@opentelemetry/api-logs';

import { getLogFormat, getLogLevel, isBrowser, isLocal } from '../environment/env';
import { isRecord } from '../validators/validate';
import { getBrowserLogSink } from './browser-sink';
import { getClientId, getRequestId, getTraceContext } from './context';
import { type LogEntry, type LogLevel, type LogMode, formatJSON, formatPretty } from './formatters';
import { redact } from './redactor';

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

    const localMode = options.mode ?? (getLogFormat() === 'json' ? 'json' : 'pretty');
    const resolvedMode: 'pretty' | 'json' = isLocal() ? localMode : 'json';

    this.options = {
      color: options.color ?? true,
      level: options.level ?? defaultLogLevel,
      mode: resolvedMode,
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

    const ambientRequestId = getRequestId();
    const traceContext = getTraceContext();

    const {
      clientId: metadataClientId,
      requestId: metadataRequestId,
      ...context
    } = isRecord(redactedMetadata) ? redactedMetadata : {};
    const fallbackRequestId = ambientRequestId === 'no-id' ? undefined : ambientRequestId;
    const requestId = typeof metadataRequestId === 'string' ? metadataRequestId : fallbackRequestId;
    const clientId = typeof metadataClientId === 'string' ? metadataClientId : getClientId();

    const entry: LogEntry = {
      level,
      message,
      ...(Object.keys(context).length > 0 ? { context } : {}),
      ...(requestId === undefined ? {} : { requestId }),
      ...(clientId === undefined ? {} : { clientId }),
      ...(traceContext ? { spanId: traceContext.spanId, traceId: traceContext.traceId } : {}),
      timestamp: this.options.timestamp ? new Date().toISOString() : '',
    };

    this.writeToOutputs(entry);
  }

  private writeToOtel(entry: LogEntry): void {
    if (isBrowser() || this.silent) {
      return;
    }

    const context = entry.context ?? {};
    const { spanId: _spanId, traceId: _traceId, ...otelEntry } = entry;

    this.otelLogger.emit({
      attributes: {
        'client.id': entry.clientId,
        context: Object.keys(context).length > 0 ? JSON.stringify(context) : undefined,
        logger: 'application',
        'request.id': entry.requestId,
        timestamp: entry.timestamp,
      },
      body: JSON.stringify(otelEntry),
      severityNumber: otelSeverity[entry.level],
      severityText: entry.level.toUpperCase(),
    });
  }

  private writeToOutputs(entry: LogEntry): void {
    try {
      getBrowserLogSink()?.pushLog(entry);
    } catch {
      // Skip RUM logging if it fails
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

export { Logger, logLevelPriority, logger, otelSeverity };
export type { LoggerOptions };
