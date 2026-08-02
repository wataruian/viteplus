import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import wcwidth from 'wcwidth';

const getRandomText = () =>
  Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);

const safeToString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      throw new Error(`Failed to convert object to string`);
    }
  }

  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  ) {
    return String(value);
  }

  try {
    return Object.prototype.toString.call(value);
  } catch {
    throw new Error(`Failed to convert ${typeof value} value to string`);
  }
};

const generateUuid = () => uuidv4();

const generateShortUuid = (length = 7) => {
  const uuid = generateUuid();
  const hash = crypto.createHash('sha1').update(uuid).digest('hex');
  return hash.slice(0, Math.max(0, length));
};

const padEmoji = (
  emoji = '🚀',
  targetWidth = 2,
  padChar = ' ',
  padRight = true,
  addSpace = false,
): string => {
  if (!emoji) {
    return padChar.repeat(targetWidth);
  }

  const codePoint = emoji.codePointAt(0) ?? 0;
  const isLikelyEmoji = codePoint > 8000 || emoji.includes('️') || emoji.includes('‍');

  const contentWidth = isLikelyEmoji ? 2 : wcwidth(emoji);

  const effectiveWidth = addSpace ? contentWidth + 1 : contentWidth;
  const padAmount = Math.max(0, targetWidth - effectiveWidth);
  const padding = padChar.repeat(padAmount);

  const displayContent = addSpace ? `${emoji} ` : emoji;

  return padRight ? displayContent + padding : padding + displayContent;
};

const upperCaseFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);

const uppercasePerWord = (str: string): string => str.replaceAll(/\b\w/gu, (c) => c.toUpperCase());

export {
  generateShortUuid,
  generateUuid,
  getRandomText,
  padEmoji,
  safeToString,
  upperCaseFirstLetter,
  uppercasePerWord,
};
