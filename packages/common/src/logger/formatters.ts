import { chalkInstance, defaultColor, getRandomColor } from '../utils/color';
import { getColor } from './context';

type LogMode = 'pretty' | 'json';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  [key: string]: unknown;
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown> | object;
  sessionId?: string;
  spanId?: string;
  traceId?: string;
}

const formatColors = {
  debug: chalkInstance.gray,
  error: chalkInstance.red,
  info: chalkInstance.blue,
  warn: chalkInstance.yellow,
};

const colorizeMessage = (entry: LogEntry, useColor: boolean): string => {
  if (!useColor) {
    return entry.message;
  }

  const explicitSessionId =
    entry.context && 'sessionId' in entry.context ? entry.context['sessionId'] : undefined;

  const sessionColor =
    typeof explicitSessionId === 'string' ? getRandomColor(explicitSessionId) : getColor();

  return sessionColor === defaultColor ? entry.message : sessionColor(entry.message);
};

const formatTraceSuffix = (entry: LogEntry, useColor: boolean): string => {
  if (entry.traceId === undefined) {
    return '';
  }

  const traceStr = `trace=${entry.traceId} span=${entry.spanId ?? ''}`;
  return ` ${useColor ? chalkInstance.gray(traceStr) : traceStr}`;
};

const formatContextSuffix = (entry: LogEntry, useColor: boolean): string => {
  if (entry.context === undefined || Object.keys(entry.context).length === 0) {
    return '';
  }

  const contextStr = JSON.stringify(entry.context, undefined, 5);
  return `\n${useColor ? chalkInstance.gray(contextStr) : contextStr}`;
};

const formatPretty = (entry: LogEntry, useColor = true): string => {
  const timestamp = useColor ? chalkInstance.white(entry.timestamp) : entry.timestamp;
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const coloredLevel = useColor ? formatColors[entry.level](levelStr) : levelStr;
  const messageText = colorizeMessage(entry, useColor);

  return `[${timestamp}] ${coloredLevel}: ${messageText}${formatTraceSuffix(entry, useColor)}${formatContextSuffix(entry, useColor)}`;
};

const formatJSON = (entry: LogEntry): string => JSON.stringify(entry);

export {
  colorizeMessage,
  formatColors,
  formatContextSuffix,
  formatJSON,
  formatPretty,
  formatTraceSuffix,
};
export type { LogEntry, LogLevel, LogMode };
