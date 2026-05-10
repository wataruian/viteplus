import type { LogEntry } from '../types/log';
import pc from 'picocolors';

const formatColors = {
  debug: pc.gray,
  error: pc.red,
  info: pc.blue,
  warn: pc.yellow,
};

const formatPretty = (entry: LogEntry, useColor = true): string => {
  const timestamp = useColor ? pc.gray(entry.timestamp) : entry.timestamp;
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const coloredLevel = useColor ? formatColors[entry.level](levelStr) : levelStr;

  let output = `[${timestamp}] ${coloredLevel}: ${entry.message}`;

  if (entry.metadata !== undefined && Object.keys(entry.metadata).length > 0) {
    const metadataStr = JSON.stringify(entry.metadata, undefined, 5);
    output += `\n${useColor ? pc.gray(metadataStr) : metadataStr}`;
  }

  return output;
};

const formatJSON = (entry: LogEntry): string => JSON.stringify(entry);

export { formatColors, formatPretty, formatJSON };
