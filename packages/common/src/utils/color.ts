import chalk from 'chalk';

import { getEnv } from '../environment/env';
import { getRandomText } from './text';

const chalkInstance = chalk;
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

type ColorFunction = (text: string) => string;

const green = chalkInstance.hex('#2ECC71');
const magenta = chalkInstance.hex('#E056FD');
const orange = chalkInstance.hex('#FF8C00');
const purple = chalkInstance.hex('#9B59B6');
const pink = chalkInstance.hex('#FF69B4');
const teal = chalkInstance.hex('#1ABC9C');

const colors: ColorFunction[] = [green, magenta, orange, purple, pink, teal];

const ansiEscapeCodeRegex = /^(?<ansi>\u001B\[[0-9;]*m)/u;

const defaultColor = chalkInstance.white;
const resetColor = chalkInstance.reset;
const resetColorAnsiEscapeCode = '\u001B[39m';

const sessionColors = new Map<string, ColorFunction>();
let globalColorIndex = 0;

const getRandomColor = (id = '') => {
  let colorId = id;
  if (!colorId) {
    colorId = getRandomText();
  } else if (colorId === 'no-id') {
    return defaultColor;
  }

  const cachedColor = sessionColors.get(colorId);
  if (cachedColor !== undefined) {
    return cachedColor;
  }

  const color = colors[globalColorIndex];
  globalColorIndex = (globalColorIndex + 1) % colors.length;

  sessionColors.set(colorId, color);

  if (sessionColors.size > 1000) {
    const [firstKey] = sessionColors.keys();
    sessionColors.delete(firstKey);
  }

  return color;
};

const getNextRandomColor = (id: string, previousColor: ColorFunction | undefined) => {
  let colorId = id;
  if (!colorId) {
    colorId = getRandomText();
  }

  const nextColor = getRandomColor(colorId);

  if (previousColor === undefined || nextColor !== previousColor) {
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
  ansiEscapeCodeRegex,
  chalkInstance,
  chalkLevelEnv,
  colors,
  defaultChalkLevel,
  defaultColor,
  getAnsiEscapeCodes,
  getNextRandomColor,
  getRandomColor,
  normalizedChalkLevel,
  parsedLevel,
  resetColor,
  resetColorAnsiEscapeCode,
  sessionColors,
};
export type { ColorFunction };
