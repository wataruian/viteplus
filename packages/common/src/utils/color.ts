import chalk from 'chalk';
const chalkInstance = chalk;
export { chalkInstance };
import { getEnv } from '../environment/env';
import { getRandomText } from './text';

const defaultChalkLevel = 3 as 0 | 1 | 2 | 3;
const chalkLevelEnv = getEnv('CHALK_LEVEL') ?? defaultChalkLevel.toString();

const parsedLevel = Math.trunc(Number(chalkLevelEnv));
const normalizedChalkLevel = Number.isNaN(parsedLevel) ? 3 : Math.min(3, Math.max(0, parsedLevel));

if (normalizedChalkLevel === 0) {
  chalk.level = 0;
} else if (normalizedChalkLevel === 1) {
  chalk.level = 1;
} else if (normalizedChalkLevel === 2) {
  chalk.level = 2;
} else {
  chalk.level = 3;
}

const colors = [chalk.red, chalk.green, chalk.blue, chalk.yellow, chalk.cyan, chalk.magenta];

const ansiEscapeCodeRegex = /^(?<ansi>\u001B\[[0-9;]*m)/u;

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
    [...new Intl.Segmenter().segment(colorId)].reduce(
      (acc, { segment }) => acc + (segment.codePointAt(0) ?? 0),
      0,
    ) % colors.length;

  return colors[index];
};

const getNextRandomColor = (id: string, previousColor: typeof chalk | undefined) => {
  let colorId = id;
  if (!colorId) {
    colorId = getRandomText();
  }

  const nextColor = getRandomColor(colorId);

  if (previousColor === undefined || nextColor.level !== previousColor.level) {
    return { nextColor, previousColor };
  }

  const previousColorIndex = colors.indexOf(previousColor);

  const nextColorIndex = (previousColorIndex + 1) % colors.length;

  return { nextColor: colors[nextColorIndex], previousColor };
};

const getAnsiEscapeCodes = (colorFunction: (text: string) => string) => {
  const testString = getRandomText();
  const coloredString = colorFunction(testString);

  const escapeCodeMatch = ansiEscapeCodeRegex.exec(coloredString);

  if (escapeCodeMatch) {
    return {
      close: resetColorAnsiEscapeCode,
      open: escapeCodeMatch[0],
    };
  }

  return { close: '', open: '' };
};

export {
  chalkLevelEnv,
  defaultChalkLevel,
  colors,
  defaultColor,
  parsedLevel,
  normalizedChalkLevel,
  getAnsiEscapeCodes,
  getNextRandomColor,
  getRandomColor,
  resetColor,
  ansiEscapeCodeRegex,
  resetColorAnsiEscapeCode,
};
