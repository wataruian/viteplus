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

const generateUuid = () => globalThis.crypto.randomUUID();

const generateShortUuid = (length = 7) => {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, Math.max(0, length));
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

  const contentWidth = isLikelyEmoji ? 2 : [...new Intl.Segmenter().segment(emoji)].length;

  const effectiveWidth = addSpace ? contentWidth + 1 : contentWidth;
  const padAmount = Math.max(0, targetWidth - effectiveWidth);
  const padding = padChar.repeat(padAmount);

  const displayContent = addSpace ? `${emoji} ` : emoji;

  return padRight ? displayContent + padding : padding + displayContent;
};

const upperCaseFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);

const uppercasePerWord = (str: string): string => str.replaceAll(/\b\w/gu, (c) => c.toUpperCase());

const toPascalCase = (str: string): string =>
  str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

export {
  generateShortUuid,
  generateUuid,
  getRandomText,
  padEmoji,
  safeToString,
  toPascalCase,
  upperCaseFirstLetter,
  uppercasePerWord,
};
