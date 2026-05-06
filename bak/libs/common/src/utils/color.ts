import chalk, { type ChalkInstance, type ColorSupportLevel } from 'chalk';

import { getRandomText } from './text';

const DEFAULT_CHALK_LEVEL = 3 as ColorSupportLevel;

chalk.level = process.env['CHALK_LEVEL']
  ? (Number.parseInt(process.env['CHALK_LEVEL'], 10) as ColorSupportLevel)
  : DEFAULT_CHALK_LEVEL;

const colors = [
  chalk.red,
  chalk.green,
  chalk.blue,
  chalk.yellow,
  chalk.cyan,
  chalk.magenta,
];

// biome-ignore lint/suspicious/noControlCharactersInRegex: ignore
const ANSI_ESCAPE_CODE_REGEX = /^(\u001B\[[0-9;]*m)/;

const defaultColor = chalk.white;
const resetColor = chalk.reset;
const resetColorAnsiEscapeCode = '\u001B[39m';

const getRandomColor = (id = '') => {
  let colorId = id;
  if (!colorId) {
    colorId = getRandomText();
  } else if (colorId === 'no-id') {
    return chalk.white;
  }

  const index =
    [...colorId].reduce((acc, char) => acc + (char.codePointAt(0) ?? 0), 0) %
    colors.length;

  return colors[index];
};

const getNextRandomColor = (
  id: string,
  previousColor: ChalkInstance | undefined
) => {
  let colorId = id;
  if (!colorId) {
    colorId = getRandomText();
  }

  const nextColor = getRandomColor(colorId);

  if (
    !previousColor ||
    (nextColor && nextColor.level !== previousColor.level)
  ) {
    return { nextColor, previousColor };
  }

  const previousColorIndex = colors.indexOf(previousColor);

  const nextColorIndex = (previousColorIndex + 1) % colors.length;

  return { nextColor: colors[nextColorIndex], previousColor };
};

const getAnsiEscapeCodes = (colorFunction: (text: string) => string) => {
  const testString = getRandomText();
  const coloredString = colorFunction(testString);

  const escapeCodeMatch = coloredString.match(ANSI_ESCAPE_CODE_REGEX);

  if (escapeCodeMatch) {
    return {
      close: resetColorAnsiEscapeCode,
      open: escapeCodeMatch[0],
    };
  }

  return { close: '', open: '' };
};

export {
  colors,
  defaultColor,
  getAnsiEscapeCodes,
  getNextRandomColor,
  getRandomColor,
  resetColor,
  resetColorAnsiEscapeCode,
};
