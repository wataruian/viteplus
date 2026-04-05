import type { LogEntry } from './types';
import pc from 'picocolors';

const COLORS = {
  debug: pc.gray,
  error: pc.red,
  info: pc.blue,
  warn: pc.yellow,
};

const INDENT_METADATA = 2;
const PADDING_LEVEL = 5;

export const formatPretty = (entry: LogEntry, useColor = true): string => {
  const timestamp = useColor ? pc.gray(entry.timestamp) : entry.timestamp;
  const levelStr = entry.level.toUpperCase().padEnd(PADDING_LEVEL);
  const coloredLevel = useColor ? COLORS[entry.level](levelStr) : levelStr;

  let output = `[${timestamp}] ${coloredLevel}: ${entry.message}`;

  if (entry.metadata !== undefined && Object.keys(entry.metadata).length > 0) {
    const metadataStr = JSON.stringify(entry.metadata, undefined, INDENT_METADATA);
    output += `\n${useColor ? pc.gray(metadataStr) : metadataStr}`;
  }

  return output;
};

export const formatJSON = (entry: LogEntry): string => JSON.stringify(entry);
