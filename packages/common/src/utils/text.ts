const getRandomText = () => globalThis.crypto.randomUUID().replaceAll('-', '');

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);

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

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SHORT_UUID_LENGTH = 22;

const generateShortUuid = (): string => {
  let value = BigInt(`0x${generateUuid().replaceAll('-', '')}`);
  let encoded = '';
  for (let index = 0; index < SHORT_UUID_LENGTH; index += 1) {
    encoded = BASE62_ALPHABET.charAt(Number(value % 62n)) + encoded;
    value /= 62n;
  }
  return encoded;
};

const decodeShortUuid = (shortUuid: string): string => {
  let value = 0n;
  for (const char of shortUuid) {
    const digit = BASE62_ALPHABET.indexOf(char);
    if (digit === -1) {
      throw new TypeError(`Not a short UUID: ${shortUuid}`);
    }
    value = value * 62n + BigInt(digit);
  }
  const hex = value.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

  const isLikelyEmoji =
    /^[\u{1F41}-\u{10FFFF}]/u.test(emoji) || emoji.includes('️') || emoji.includes('‍');

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
  decodeShortUuid,
  escapeRegExp,
  generateShortUuid,
  generateUuid,
  getRandomText,
  padEmoji,
  safeToString,
  toPascalCase,
  upperCaseFirstLetter,
  uppercasePerWord,
};
