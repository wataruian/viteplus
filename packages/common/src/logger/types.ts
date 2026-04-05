export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogMode = 'pretty' | 'json';

export interface RotationOptions {
  compress?: string | boolean;
  interval?: string;
  size?: string;
}

export interface LoggerOptions {
  color: boolean;
  level: LogLevel;
  mode: LogMode;
  outputPath?: string | undefined;
  redact: string[];
  rotation?: RotationOptions | undefined;
  timestamp: boolean;
}

export interface InternalStream {
  write: (
    data: string | Uint8Array,
    callback?: (error: Error | null | undefined) => void,
  ) => boolean;
}

export interface LogStream {
  write: (data: string) => void;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown> | undefined;
  [key: string]: unknown;
}

export type RedactFn = (target: unknown, fields: string[], redactValue: string) => unknown;
