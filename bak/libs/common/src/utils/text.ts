import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import wcwidth from 'wcwidth';

const RANDOM_STRING_START_INDEX = 2;
const RANDOM_STRING_END_INDEX = 15;
const BASE36_RADIX = 36;
const EMOJI_UNICODE_THRESHOLD = 8000;

const getRandomText = () => {
  return (
    Math.random()
      .toString(BASE36_RADIX)
      .slice(RANDOM_STRING_START_INDEX, RANDOM_STRING_END_INDEX) +
    Math.random()
      .toString(BASE36_RADIX)
      .slice(RANDOM_STRING_START_INDEX, RANDOM_STRING_END_INDEX)
  );
};

/**
 * Safely converts any value to a string
 */
const safeToString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      throw new Error(
        `Failed to convert object to string: ${JSON.stringify(value)}`
      );
    }
  }
  if (Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      throw new Error(
        `Failed to convert array to string: ${JSON.stringify(value)}`
      );
    }
  }
  try {
    return String(value);
  } catch {
    throw new Error(
      `Failed to ${typeof value} convert value to string:`,
      value
    );
  }
};

const generateShortUuid = (length = 7) => {
  const uuid = uuidv4();
  const hash = crypto.createHash('sha1').update(uuid).digest('hex');
  return hash.slice(0, Math.max(0, length));
};

/**
 * Pads an emoji or text to ensure consistent alignment in terminal output
 * @param emoji The emoji or text to pad
 * @param targetWidth The desired width after padding (default: 2 for emojis)
 * @param padChar The character to use for padding (default: space)
 * @param padRight Whether to pad after (true) or before (false) the content
 * @param addSpace Whether to add a space after the emoji (default: false)
 * @returns The padded string
 */
const padEmoji = (
  emoji = '🚀',
  targetWidth = 2,
  padChar = ' ',
  padRight = true,
  addSpace = false
): string => {
  // Handle empty input
  if (!emoji) {
    return padChar.repeat(targetWidth);
  }

  // For emojis, we'll use a fixed width of 2
  const isLikelyEmoji =
    (emoji.codePointAt(0) || 0) > EMOJI_UNICODE_THRESHOLD ||
    emoji.includes('️') ||
    emoji.includes('‍');

  // Calculate the effective width
  const contentWidth = isLikelyEmoji ? 2 : wcwidth(emoji);

  // Calculate padding needed to reach target width
  // If we're adding a space, account for it in the padding calculation
  const effectiveWidth = addSpace ? contentWidth + 1 : contentWidth;
  const padAmount = Math.max(0, targetWidth - effectiveWidth);
  const padding = padChar.repeat(padAmount);

  // Build the content with optional space
  const displayContent = addSpace ? `${emoji} ` : emoji;

  // Apply padding in the requested direction
  return padRight ? displayContent + padding : padding + displayContent;
};

const upperCaseFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const uppercasePerWord = (str: string): string => {
  return str.replaceAll(/\b\w/g, c => c.toUpperCase());
};

export {
  generateShortUuid,
  getRandomText,
  padEmoji,
  safeToString,
  upperCaseFirstLetter,
  uppercasePerWord,
};
