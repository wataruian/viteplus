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
  requestId?: string;
  clientId?: string;
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

  const requestColor = entry.requestId === undefined ? getColor() : getRandomColor(entry.requestId);

  return requestColor === defaultColor ? entry.message : requestColor(entry.message);
};

const formatIdSuffix = (entry: LogEntry, useColor: boolean): string => {
  const parts = [
    ...(entry.requestId === undefined ? [] : [`request=${entry.requestId}`]),
    ...(entry.clientId === undefined ? [] : [`client=${entry.clientId}`]),
    ...(entry.traceId === undefined ? [] : [`trace=${entry.traceId} span=${entry.spanId ?? ''}`]),
  ];
  if (parts.length === 0) {
    return '';
  }

  const idStr = parts.join(' ');
  return ` ${useColor ? chalkInstance.gray(idStr) : idStr}`;
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

  return `[${timestamp}] ${coloredLevel}: ${messageText}${formatIdSuffix(entry, useColor)}${formatContextSuffix(entry, useColor)}`;
};

const formatJSON = (entry: LogEntry): string => JSON.stringify(entry);

export {
  colorizeMessage,
  formatColors,
  formatContextSuffix,
  formatIdSuffix,
  formatJSON,
  formatPretty,
};
export type { LogEntry, LogLevel, LogMode };
