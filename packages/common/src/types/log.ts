type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMode = 'pretty' | 'json';

interface RotationOptions {
  compress?: string | boolean;
  interval?: string;
  size?: string;
}

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

interface InternalStream {
  write: (
    data: string | Uint8Array,
    callback?: (error: Error | null | undefined) => void,
  ) => boolean;
}

interface LogStream {
  write: (data: string) => void;
}

interface LogEntry {
  [key: string]: unknown;
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown> | object;
}

type RedactFn = (target: unknown, fields: string[], redactValue: string) => unknown;

export type {
  LogLevel,
  LogMode,
  RotationOptions,
  LoggerOptions,
  InternalStream,
  LogStream,
  LogEntry,
  RedactFn,
};
