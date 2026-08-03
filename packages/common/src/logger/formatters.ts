import { chalkInstance, defaultColor } from '../utils/color';
import type { LogEntry } from '../types/log';
import { getColor } from './context';

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
    const sessionColor = getColor();
    if (sessionColor !== defaultColor) {
      messageText = sessionColor(messageText);
    }
  }

  let output = `[${timestamp}] ${coloredLevel}: ${messageText}`;

  if (entry.metadata !== undefined && Object.keys(entry.metadata).length > 0) {
    const metadataStr = JSON.stringify(entry.metadata, undefined, 5);
    output += `\n${useColor ? chalkInstance.gray(metadataStr) : metadataStr}`;
  }

  return output;
};

const formatJSON = (entry: LogEntry): string => JSON.stringify(entry);

export { formatColors, formatPretty, formatJSON };
