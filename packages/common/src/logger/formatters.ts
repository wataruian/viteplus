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

const formatPretty = (entry: LogEntry, useColor = true): string => {
  const timestamp = useColor ? chalkInstance.white(entry.timestamp) : entry.timestamp;
  const levelStr = entry.level.toUpperCase().padEnd(5);

  const coloredLevel = useColor ? formatColors[entry.level](levelStr) : levelStr;

  let messageText = entry.message;
  if (useColor) {
    const explicitSessionId =
      entry.context && 'sessionId' in entry.context ? entry.context['sessionId'] : undefined;

    const sessionColor =
      typeof explicitSessionId === 'string' ? getRandomColor(explicitSessionId) : getColor();

    if (sessionColor !== defaultColor) {
      messageText = sessionColor(messageText);
    }
  }

  let output = `[${timestamp}] ${coloredLevel}: ${messageText}`;

  if (entry.traceId !== undefined) {
    const traceStr = `trace=${entry.traceId} span=${entry.spanId ?? ''}`;
    output += ` ${useColor ? chalkInstance.gray(traceStr) : traceStr}`;
  }

  if (entry.context !== undefined && Object.keys(entry.context).length > 0) {
    const contextStr = JSON.stringify(entry.context, undefined, 5);
    output += `\n${useColor ? chalkInstance.gray(contextStr) : contextStr}`;
  }

  return output;
};

const formatJSON = (entry: LogEntry): string => JSON.stringify(entry);

export { formatColors, formatJSON, formatPretty };
export type { LogEntry, LogLevel, LogMode };
