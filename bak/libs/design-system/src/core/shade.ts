// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
type ShadeStep = Record<ShadeValue, number>;
type ShadeValue = (typeof standardShadeValues)[number];

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------
const SHADE_50 = 50;
const SHADE_100 = 100;
const SHADE_200 = 200;
const SHADE_300 = 300;
const SHADE_400 = 400;
const SHADE_500 = 500;
const SHADE_600 = 600;
const SHADE_700 = 700;
const SHADE_800 = 800;
const SHADE_900 = 900;
const SHADE_950 = 950;

const standardShadeValues = [
  SHADE_50,
  SHADE_100,
  SHADE_200,
  SHADE_300,
  SHADE_400,
  SHADE_500,
  SHADE_600,
  SHADE_700,
  SHADE_800,
  SHADE_900,
  SHADE_950,
] as const;

const LIGHTNESS_VERY_LIGHT = 0.95; // 50
const LIGHTNESS_100 = 0.85;
const LIGHTNESS_200 = 0.75;
const LIGHTNESS_300 = 0.65;
const LIGHTNESS_400 = 0.55;
const LIGHTNESS_BASE = 0.45; // 500 (base)
const LIGHTNESS_600 = 0.35;
const LIGHTNESS_700 = 0.25;
const LIGHTNESS_800 = 0.15;
const LIGHTNESS_900 = 0.05;
const LIGHTNESS_VERY_DARK = 0.01; // 950

const lightnessAdjustments = [
  LIGHTNESS_VERY_LIGHT, // 50 (very light)
  LIGHTNESS_100, // 100
  LIGHTNESS_200, // 200
  LIGHTNESS_300, // 300
  LIGHTNESS_400, // 400
  LIGHTNESS_BASE, // 500 (base)
  LIGHTNESS_600, // 600
  LIGHTNESS_700, // 700
  LIGHTNESS_800, // 800
  LIGHTNESS_900, // 900
  LIGHTNESS_VERY_DARK, // 950 (very dark)
] as const;

// ----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------------
// /**
//  * Generate a set of lightness steps based on a base lightness and an optional set of adjustments
//  * @param baseLightness The base lightness value to start from
//  * @param adjustments An optional set of adjustments to apply to the base lightness
//  * @returns A set of lightness steps
//  */
// const calculateLightnessSteps = (
//   baseLightness: number,
//   adjustments: readonly number[] = lightnessAdjustments
// ): number[] => {
//   return [...adjustments].map(adjustment =>
//     Math.min(Math.max(baseLightness * adjustment, 0.01), 0.95)
//   );
// };

/**
 * Compare two shade values numerically
 * @param a The first shade value
 * @param b The second shade value
 * @returns A number indicating the comparison result
 */
const compareShadeValues = (
  a: number | ShadeValue,
  b: number | ShadeValue
): number => {
  const aValue = extractShadeValue(a);
  const bValue = extractShadeValue(b);
  return aValue - bValue;
};

// /**
//  * Retrieves the standard shade values
//  * @returns An array of standard shade values
//  */
// const getShadeValues = (): ShadeValue[] => {
//   return [...standardShadeValues];
// };

// /**
//  * Validates if a given value is a valid shade value
//  * @param value The value to check
//  * @returns Boolean indicating if the value is a valid shade
//  */
// const isValidShade = (value: number): boolean => {
//   return standardShadeValues.includes(value as ShadeValue);
// };

/**
 * Extracts the shade value from a given input
 * @param shade The input shade value
 * @returns The extracted shade value
 */
const extractShadeValue = (shade: number | ShadeValue): number => {
  // If it's already a number, return it
  if (typeof shade === 'number') {
    return shade;
  }

  // If it's a ShadeValue, find its numeric representation
  const numericShade = standardShadeValues.find(value => value === shade);

  // If not found, throw an error
  if (numericShade === undefined) {
    throw new Error(`Invalid shade value: ${shade}`);
  }

  return numericShade;
};

export type { ShadeStep, ShadeValue };

export {
  compareShadeValues,
  extractShadeValue,
  lightnessAdjustments,
  standardShadeValues,
};
