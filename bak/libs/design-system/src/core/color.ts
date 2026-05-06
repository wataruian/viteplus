import type { Oklch } from 'culori';
import { converter, formatHex, parse } from 'culori';

import {
  compareShadeValues,
  extractShadeValue,
  lightnessAdjustments,
  type ShadeValue,
  standardShadeValues,
} from './shade';
import { defaultThemeBaseColors } from './theme';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
type ColorCategory =
  | 'accent'
  | 'error'
  | 'info'
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning';
interface ColorConfig {
  classes: string[];
  colors: ColorToken;
  css: string;
  name: string;
}
type ColorPalette = Record<ColorCategory, string>;
type ColorProperties = Record<ShadeValue, string>;
type ColorScheme = 'dark' | 'light' | 'system';
type ColorSchemePalette = Record<
  FilteredColorScheme,
  Record<ShadeValue, string>
>;
interface ColorSchemeVariant {
  dark: Record<ShadeValue, string>;
  light: Record<ShadeValue, string>;
}
type ColorSemantics = Record<ColorCategory, ColorProperties>;
type ColorToken = {
  [Category in ColorCategory]: {
    [Key in ShadeValue]: string;
  } & {
    dark: Record<ShadeValue, string>;
    light: Record<ShadeValue, string>;
  };
};
type FilteredColorScheme = Exclude<ColorScheme, 'system'>;

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------
const colorVariants = ['bg', 'text', 'border'] as const;
const colorSchemeOptions = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
} as const;

const HEX_HASH_PATTERN = /^#/;

// ----------------------------------------------------------------------------
// COLOR CONVERSION AND GENERATION UTILITY CLASS
// ----------------------------------------------------------------------------
class Color {
  private readonly baseColors: ColorPalette;
  private readonly classes: string[];
  private readonly colors: ColorToken;
  private readonly css: string;

  private readonly designTokens: ColorConfig | null = null;

  // Color generation strategy configuration
  private readonly generationConfig = {
    offsets: {
      analogous: 30,
      complementary: 180,
      triadic: {
        second: 120,
        third: 240,
      },
    },
    strategies: {
      analogous: 'Generates colors 30 degrees on either side of the base hue',
      complementary:
        'Generates a color 180 degrees opposite on the color wheel',
      triadic: 'Generates colors 120 degrees apart on the color wheel',
    },
  };

  // Color generation constraints and limits
  private readonly generationLimits = {
    maxChroma: 0.6,
    maxLightness: 0.95,
    minLightness: 0.05,
  };

  // Color modulation constants
  private static readonly MID_LIGHTNESS = 0.5;
  private static readonly MAX_SHADE_VALUE = 900;
  private static readonly DEFAULT_SHADE_VALUE = 500;
  private static readonly DEGREES_IN_SEMICIRCLE = 180;
  private static readonly DEGREES_IN_FULL_CIRCLE = 360;
  private static readonly HUE_MODULATION_AMPLITUDE = 0.1;

  // Default fallback values for color conversion
  private static readonly DEFAULT_LIGHTNESS_FALLBACK = 0.5;
  private static readonly DEFAULT_CHROMA_FALLBACK = 0.2;
  private static readonly DEFAULT_HUE_FALLBACK = 0;

  // Default hue offset constants for color variation generation
  private static readonly DEFAULT_HUE_OFFSET_30 = 30;
  private static readonly DEFAULT_HUE_OFFSET_90 = 90;

  // Hexadecimal radix constant for color parsing
  private static readonly HEX_RADIX = 16;

  // RGB color component maximum value (8-bit)
  private static readonly RGB_MAX_VALUE = 255;

  // Hex color component slice indices
  private static readonly HEX_RED_START = 0;
  private static readonly HEX_RED_END = 2;
  private static readonly HEX_GREEN_START = 2;
  private static readonly HEX_GREEN_END = 4;
  private static readonly HEX_BLUE_START = 4;
  private static readonly HEX_BLUE_END = 6;

  // Color palette generation constants for lightness and chroma adjustments
  private static readonly SHADE_50_LIGHTNESS_OFFSET = 0.4;
  private static readonly SHADE_50_CHROMA_MULTIPLIER = 0.5;
  private static readonly SHADE_100_LIGHTNESS_OFFSET = 0.3;
  private static readonly SHADE_100_CHROMA_MULTIPLIER = 0.6;
  private static readonly SHADE_200_LIGHTNESS_OFFSET = 0.2;
  private static readonly SHADE_200_CHROMA_MULTIPLIER = 0.7;
  private static readonly SHADE_300_LIGHTNESS_OFFSET = 0.1;
  private static readonly SHADE_300_CHROMA_MULTIPLIER = 0.8;
  private static readonly SHADE_400_LIGHTNESS_OFFSET = 0.05;
  private static readonly SHADE_400_CHROMA_MULTIPLIER = 0.9;
  private static readonly SHADE_600_LIGHTNESS_OFFSET = -0.05;
  private static readonly SHADE_600_CHROMA_MULTIPLIER = 0.9;
  private static readonly SHADE_700_LIGHTNESS_OFFSET = -0.1;
  private static readonly SHADE_700_CHROMA_MULTIPLIER = 0.8;
  private static readonly SHADE_800_LIGHTNESS_OFFSET = -0.2;
  private static readonly SHADE_800_CHROMA_MULTIPLIER = 0.7;
  private static readonly SHADE_900_LIGHTNESS_OFFSET = -0.3;
  private static readonly SHADE_900_CHROMA_MULTIPLIER = 0.6;
  private static readonly SHADE_950_LIGHTNESS_OFFSET = -0.4;
  private static readonly SHADE_950_CHROMA_MULTIPLIER = 0.5;
  private static readonly DEFAULT_LIGHTNESS_ADJUSTMENT = 0.45;

  private readonly name: string;

  /**
   * Constructor for the Color class
   * @param name The theme name
   * @param baseColors The base colors for theme
   */
  constructor(name: string, baseColors: ColorPalette) {
    this.name = name;
    this.baseColors = baseColors;

    const generatedDesignTokens = this.generateDesignTokens(
      this.name,
      this.baseColors
    );

    this.colors = generatedDesignTokens.colors;
    this.classes = generatedDesignTokens.classes;
    this.css = generatedDesignTokens.css;

    this.designTokens = {
      classes: this.classes,
      colors: this.colors,
      css: this.css,
      name: this.name,
    };
  }

  /**
   * Retrieves the design tokens for the color
   * @returns The design tokens for the color
   */
  getDesignTokens(): ColorConfig {
    if (!this.designTokens) {
      throw new Error('Design tokens not initialized');
    }
    return this.designTokens;
  }

  /**
   * Calculates optimal chroma for a given shade
   * @param lightness Current lightness value of the color
   * @param hue Color hue in degrees
   * @param shade Shade value (e.g., 50, 100, 200, etc.)
   * @param baseChroma Base chroma of the original color
   * @returns Optimal chroma value for the specific shade
   */
  private calculateOptimalChroma(
    lightness: number,
    hue: number,
    shade: ShadeValue,
    baseChroma: number
  ): number {
    // Extract the numeric shade value and normalize it
    // This converts shade values like 50, 100, 200 to a 0-1 range
    const shadeMultiplier = extractShadeValue(shade) / Color.MAX_SHADE_VALUE;

    // Base chroma modulation factors
    // These factors help adjust the chroma based on different color characteristics

    // 1. Shade-based modulation:
    // Increases or decreases chroma based on the shade value
    // Lighter and darker shades will have different chroma intensities
    const shadeModulation = 1 + shadeMultiplier;

    // 2. Lightness modulation:
    // Reduces chroma for colors close to white or black
    // Creates a bell curve effect where colors near mid-lightness have more chroma
    const lightnessModulation =
      (1 - Math.abs(lightness - Color.MID_LIGHTNESS)) * // Peak at mid-lightness
      (1 - lightness); // Further reduce for very light or very dark colors

    // 3. Hue-based subtle variation:
    // Adds a slight sinusoidal variation based on hue
    // This introduces a subtle organic feel to the chroma calculation
    const hueModulation =
      1 +
      Math.sin((hue * Math.PI) / Color.DEGREES_IN_SEMICIRCLE) *
        Color.HUE_MODULATION_AMPLITUDE;

    // Final chroma calculation:
    // Multiply base chroma with all modulation factors
    return Math.min(
      baseChroma * shadeModulation * lightnessModulation * hueModulation,
      this.generationLimits.maxChroma // Ensure we don't exceed maximum chroma
    );
  }

  /**
   * Converts a light color palette to its dark mode equivalent
   * @param color Base color to convert
   * @returns Dark mode color variant
   */
  private convertToDarkVariant(color: string): string {
    // This is a placeholder method. You'll want to implement a more sophisticated
    // color conversion algorithm that considers color theory and contrast
    // For now, this is a simple inversion that might need refinement
    return this.invertColor(color);
  }

  /**
   * Generates CSS classes for a given color token
   * @param tokens Color token object
   * @returns Array of CSS classes
   */
  private generateClasses(tokens: ColorToken): string[] {
    const classes = colorVariants.flatMap(variant =>
      Object.entries(tokens).flatMap(([colorName, colorTokens]) => {
        let classList: string[] = [];
        // Outer keys (default light shades merged)
        for (const key of Object.keys(colorTokens)) {
          classList.push(`${variant}-${colorName}-${key}`);
        }
        classList.push(`${variant}-${colorName}`);
        // Additional light and dark variants for each shade value
        for (const scheme of ['light', 'dark']) {
          const palette = colorTokens[
            scheme as keyof typeof colorTokens
          ] as Record<string, string>;
          for (const shade of Object.keys(palette)) {
            classList.push(`${variant}-${colorName}-${scheme}-${shade}`);
          }
          // Also include the scheme itself (e.g., bg-accent-light)
          classList.push(`${variant}-${colorName}-${scheme}`);
        }
        classList = [...new Set(classList)];
        return classList;
      })
    );
    return [...new Set(classes)];
  }

  /**
   * Generates a color palette for multiple colors
   * @param colors Color palette options
   * @returns Semantic color palette
   */
  private generateColorPalette(
    colors: ColorPalette = defaultThemeBaseColors
  ): ColorToken {
    // Ensure all color categories are represented
    const colorPalette: ColorPalette = {
      accent: colors.accent || defaultThemeBaseColors.accent,
      error: colors.error || defaultThemeBaseColors.error,
      info: colors.info || defaultThemeBaseColors.info,
      neutral: colors.neutral || defaultThemeBaseColors.neutral,
      primary: colors.primary || defaultThemeBaseColors.primary,
      secondary: colors.secondary || defaultThemeBaseColors.secondary,
      success: colors.success || defaultThemeBaseColors.success,
      warning: colors.warning || defaultThemeBaseColors.warning,
    };

    const tokens: ColorToken = Object.fromEntries(
      Object.entries(colorPalette).map(([category, color]) => {
        const lightPalette = this.generateDiverseColorPalette(color);
        const darkPalette = this.generateDiverseColorPalette(
          this.convertToDarkVariant(color)
        );
        return [
          category,
          {
            dark: darkPalette,
            light: lightPalette,
            ...lightPalette, // Merges the light shades as outer keys
          },
        ];
      })
    ) as ColorToken;
    return tokens;
  }

  /**
   * Generates CSS variables for color tokens
   * @param tokens Color tokens to generate CSS for
   * @returns CSS variables as a string
   */
  private generateCss(tokens: ColorToken): string {
    const { colorScheme = 'system' } = {
      colorScheme: 'system',
    };

    const cssString = `
      ${Object.entries(colorSchemeOptions)
        .map(
          ([colorScheme]) => `
          :root[data-color-scheme="${colorScheme}"][data-theme="${this.name}"] {
            color-scheme: ${
              colorScheme === 'system' ? 'light dark' : colorScheme
            };
            ${Object.entries(colorVariants)
              .map(
                ([_index, variant]) => `
              ${Object.entries(tokens)
                .map(([colorName, colorTokens]) => {
                  const palette = this.getPaletteForScheme(
                    colorTokens,
                    colorScheme
                  );

                  return Object.entries(palette)
                    .map(([shade, color]) => {
                      let cssVarName = `--${variant}-${colorName}-${shade}: ${color};`;
                      const cssVariables = [cssVarName];
                      if (colorScheme !== 'system') {
                        cssVarName = `--${variant}-${colorName}-${colorScheme}-${shade}: ${color};`;
                        cssVariables.push(cssVarName);
                      }
                      if (
                        compareShadeValues(
                          Number(shade),
                          Color.DEFAULT_SHADE_VALUE
                        ) === 0
                      ) {
                        cssVarName = `--${variant}-${colorName}-default: ${color};`;
                        cssVariables.push(cssVarName);
                      }
                      return cssVariables.join('\n');
                    })
                    .join('\n');
                })
                .join('\n')}
            `
              )
              .join('\n')}
          }
        `
        )
        .join('\n')}

      ${colorVariants
        .map(
          variant => `
          :root${this.name === 'default' ? '' : `[data-theme="${this.name}"]`} {
            color-scheme: ${
              colorScheme === 'system' ? 'light dark' : colorScheme
            };
          ${Object.entries(tokens)
            .map(([colorName, colorTokens]) => {
              const palette = this.getPaletteForScheme(
                colorTokens,
                colorScheme
              );

              return Object.entries(palette)
                .map(([shade, color]) => {
                  let cssVarName = `--${variant}-${colorName}-${shade}: ${color};`;
                  const cssVariables = [cssVarName];
                  if (colorScheme === 'system') {
                    // Cast to ensure dark and light are available
                    const { dark, light } = colorTokens as {
                      dark: Record<ShadeValue, string>;
                      light: Record<ShadeValue, string>;
                    };
                    const lightColor = light[shade as unknown as ShadeValue];
                    const darkColor = dark[shade as unknown as ShadeValue];
                    cssVarName = `--${variant}-${colorName}-light-${shade}: ${lightColor};`;
                    cssVariables.push(cssVarName);
                    cssVarName = `--${variant}-${colorName}-dark-${shade}: ${darkColor};`;
                    cssVariables.push(cssVarName);
                    if (
                      compareShadeValues(
                        Number(shade),
                        Color.DEFAULT_SHADE_VALUE
                      ) === 0
                    ) {
                      cssVarName = `--${variant}-${colorName}-default: ${color};`;
                      cssVariables.push(cssVarName);
                    }
                  }
                  return cssVariables.join('\n');
                })
                .join('\n');
            })
            .join('\n')}
          }`
        )
        .join('\n')}
    `;

    return cssString;
  }

  /**
   * Generates design tokens
   * @returns Design tokens
   */
  private generateDesignTokens(
    name: string,
    baseColors: ColorPalette
  ): ColorConfig {
    const colorTokens = this.generateColorPalette(baseColors);
    const classes = this.generateClasses(colorTokens);
    const css = this.generateCss(colorTokens);
    const designTokens = {
      classes,
      colors: colorTokens,
      css,
      name,
    };
    return designTokens;
  }

  /**
   * Generates a diverse color palette for a base color
   * @param baseColor Base hex color
   * @param additionalHueOffsets Optional hue offsets
   * @param useStrategicGeneration Whether to use predefined color generation strategies
   * @param useOptimalChroma Whether to use advanced chroma calculation
   * @returns Color palette with shade values
   */
  private generateDiverseColorPalette(
    baseColor: string,
    additionalHueOffsets: number[] = [
      Color.DEFAULT_HUE_OFFSET_30,
      -Color.DEFAULT_HUE_OFFSET_30,
      Color.DEFAULT_HUE_OFFSET_90,
      -Color.DEFAULT_HUE_OFFSET_90,
    ],
    useStrategicGeneration = false,
    useOptimalChroma = false
  ): Record<ShadeValue, string> {
    // Convert base color to OKLCH for easier manipulation
    const [baseLightness, baseChroma, baseHue] = this.hexToOklch(baseColor);

    // Create local variable for hue offsets to avoid parameter mutation
    let hueOffsets = [...additionalHueOffsets];

    // If strategic generation is enabled, use predefined strategies
    if (useStrategicGeneration) {
      // Complementary color generation
      const complementaryHue =
        (baseHue + this.generationConfig.offsets.complementary) %
        Color.DEGREES_IN_FULL_CIRCLE;

      // Analogous color generation
      const leftAnalogousHue =
        (baseHue -
          this.generationConfig.offsets.analogous +
          Color.DEGREES_IN_FULL_CIRCLE) %
        Color.DEGREES_IN_FULL_CIRCLE;
      const rightAnalogousHue =
        (baseHue + this.generationConfig.offsets.analogous) %
        Color.DEGREES_IN_FULL_CIRCLE;

      // Triadic color generation
      const secondTriadicHue =
        (baseHue + this.generationConfig.offsets.triadic.second) %
        Color.DEGREES_IN_FULL_CIRCLE;
      const thirdTriadicHue =
        (baseHue + this.generationConfig.offsets.triadic.third) %
        Color.DEGREES_IN_FULL_CIRCLE;

      // Combine strategic hue offsets with existing offsets
      hueOffsets = [
        ...hueOffsets,
        complementaryHue - baseHue,
        leftAnalogousHue - baseHue,
        rightAnalogousHue - baseHue,
        secondTriadicHue - baseHue,
        thirdTriadicHue - baseHue,
      ];
    }

    // Initialize the palette with the base color
    const palette: Record<ShadeValue, string> = {
      50: this.oklchToHex(
        baseLightness + Color.SHADE_50_LIGHTNESS_OFFSET,
        baseChroma * Color.SHADE_50_CHROMA_MULTIPLIER,
        baseHue
      ),
      100: this.oklchToHex(
        baseLightness + Color.SHADE_100_LIGHTNESS_OFFSET,
        baseChroma * Color.SHADE_100_CHROMA_MULTIPLIER,
        baseHue
      ),
      200: this.oklchToHex(
        baseLightness + Color.SHADE_200_LIGHTNESS_OFFSET,
        baseChroma * Color.SHADE_200_CHROMA_MULTIPLIER,
        baseHue
      ),
      300: this.oklchToHex(
        baseLightness + Color.SHADE_300_LIGHTNESS_OFFSET,
        baseChroma * Color.SHADE_300_CHROMA_MULTIPLIER,
        baseHue
      ),
      400: this.oklchToHex(
        baseLightness + Color.SHADE_400_LIGHTNESS_OFFSET,
        baseChroma * Color.SHADE_400_CHROMA_MULTIPLIER,
        baseHue
      ),
      500: baseColor,
      600: this.oklchToHex(
        baseLightness + Color.SHADE_600_LIGHTNESS_OFFSET,
        baseChroma * Color.SHADE_600_CHROMA_MULTIPLIER,
        baseHue
      ),
      700: this.oklchToHex(
        baseLightness + Color.SHADE_700_LIGHTNESS_OFFSET,
        baseChroma * Color.SHADE_700_CHROMA_MULTIPLIER,
        baseHue
      ),
      800: this.oklchToHex(
        baseLightness + Color.SHADE_800_LIGHTNESS_OFFSET,
        baseChroma * Color.SHADE_800_CHROMA_MULTIPLIER,
        baseHue
      ),
      900: this.oklchToHex(
        baseLightness + Color.SHADE_900_LIGHTNESS_OFFSET,
        baseChroma * Color.SHADE_900_CHROMA_MULTIPLIER,
        baseHue
      ),
      950: this.oklchToHex(
        baseLightness + Color.SHADE_950_LIGHTNESS_OFFSET,
        baseChroma * Color.SHADE_950_CHROMA_MULTIPLIER,
        baseHue
      ),
    };

    // Generate additional color variations using hue offsets
    for (const offset of hueOffsets) {
      const offsetHue =
        (baseHue + offset + Color.DEGREES_IN_FULL_CIRCLE) %
        Color.DEGREES_IN_FULL_CIRCLE;
      const [offsetLightness, offsetChroma] = this.hexToOklch(
        this.oklchToHex(baseLightness, baseChroma, offsetHue)
      );

      // Adjust lightness and chroma for the offset color
      const offsetPalette: Record<ShadeValue, string> = {} as Record<
        ShadeValue,
        string
      >;

      // Initialize all standard shade values with empty strings
      for (const shade of standardShadeValues) {
        offsetPalette[shade] = '';
      }
      for (const shade of standardShadeValues) {
        const lightnessAdjustment =
          lightnessAdjustments[
            Math.max(0, standardShadeValues.indexOf(shade))
          ] ?? Color.DEFAULT_LIGHTNESS_ADJUSTMENT;

        const adjustedLightness =
          offsetLightness +
          (lightnessAdjustment - Color.DEFAULT_LIGHTNESS_ADJUSTMENT);

        // Use optimal chroma calculation if enabled
        const adjustedChroma = useOptimalChroma
          ? this.calculateOptimalChroma(
              adjustedLightness,
              offsetHue,
              shade,
              offsetChroma
            )
          : offsetChroma;

        offsetPalette[shade] = this.oklchToHex(
          Math.min(
            Math.max(adjustedLightness, this.generationLimits.minLightness),
            this.generationLimits.maxLightness
          ),
          Math.min(adjustedChroma, this.generationLimits.maxChroma),
          offsetHue
        );
      }

      // Merge the offset palette, giving preference to existing colors
      for (const shadeKey of Object.keys(offsetPalette)) {
        const shade = shadeKey as unknown as ShadeValue;
        if (palette[shade] === baseColor) {
          palette[shade] = offsetPalette[shade];
        }
      }
    }

    return palette;
  }

  /**
   * Generates the palette for a given color scheme.
   * @param colorTokens The color tokens for light and dark modes.
   * @param colorScheme The color scheme to generate the palette for.
   * @returns The generated palette.
   */
  private getPaletteForScheme(
    colorTokens: {
      dark: Record<ShadeValue, string>;
      light: Record<ShadeValue, string>;
    },
    colorScheme: 'dark' | 'light' | 'system' | string = 'system'
  ) {
    const lightPalette = colorTokens.light;
    const darkPalette = colorTokens.dark ?? lightPalette;

    switch (colorScheme) {
      case 'dark': {
        return darkPalette;
      }
      case 'light': {
        return lightPalette;
      }
      case 'system': {
        // Create a new palette with light-dark() for each shade
        return Object.fromEntries(
          Object.entries(lightPalette).map(([shade, lightColor]) => {
            const darkColor = darkPalette[shade as unknown as ShadeValue];
            return [shade, `light-dark(${lightColor}, ${darkColor})`];
          })
        );
      }
      default: {
        return lightPalette;
      }
    }
  }

  /**
   * Converts a hex color to OKLCH color space
   * @param hex Hex color string
   * @returns Tuple of [lightness, chroma, hue]
   */
  private hexToOklch(hex: string): [number, number, number] {
    try {
      const parsedColor = parse(hex);
      if (!parsedColor) {
        throw new Error(`Invalid color: ${hex}`);
      }

      const oklchColor = converter('oklch')(parsedColor);
      return [
        oklchColor.l ?? Color.DEFAULT_LIGHTNESS_FALLBACK, // Lightness
        oklchColor.c ?? Color.DEFAULT_CHROMA_FALLBACK, // Chroma
        oklchColor.h ?? Color.DEFAULT_HUE_FALLBACK, // Hue
      ];
    } catch (error) {
      console.warn(
        `Color conversion error: ${error}. Falling back to default.`
      );
      return [
        Color.DEFAULT_LIGHTNESS_FALLBACK,
        Color.DEFAULT_CHROMA_FALLBACK,
        Color.DEFAULT_HUE_FALLBACK,
      ];
    }
  }

  /**
   * Simple color inversion method
   * @param hex Hex color code
   * @returns Inverted hex color code
   */
  private invertColor(hex: string): string {
    // Remove the hash at the start if it exists
    const normalizedHex = hex.replace(HEX_HASH_PATTERN, '');

    // Convert hex to RGB
    const r = Number.parseInt(
      normalizedHex.slice(Color.HEX_RED_START, Color.HEX_RED_END),
      Color.HEX_RADIX
    );
    const g = Number.parseInt(
      normalizedHex.slice(Color.HEX_GREEN_START, Color.HEX_GREEN_END),
      Color.HEX_RADIX
    );
    const b = Number.parseInt(
      normalizedHex.slice(Color.HEX_BLUE_START, Color.HEX_BLUE_END),
      Color.HEX_RADIX
    );

    // Invert the colors
    const invertedR = Color.RGB_MAX_VALUE - r;
    const invertedG = Color.RGB_MAX_VALUE - g;
    const invertedB = Color.RGB_MAX_VALUE - b;

    // Convert back to hex
    return `#${invertedR.toString(Color.HEX_RADIX).padStart(2, '0')}${invertedG
      .toString(Color.HEX_RADIX)
      .padStart(
        2,
        '0'
      )}${invertedB.toString(Color.HEX_RADIX).padStart(2, '0')}`;
  }

  /**
   * Converts OKLCH color to hex
   * @param l Lightness
   * @param c Chroma
   * @param h Hue
   * @returns Hex color string
   */
  private oklchToHex(l: number, c: number, h: number): string {
    try {
      const constrainedL = Math.max(
        this.generationLimits.minLightness,
        Math.min(this.generationLimits.maxLightness, l)
      );
      const constrainedC = Math.max(
        0,
        Math.min(this.generationLimits.maxChroma, c)
      );

      const oklchColor = {
        c: constrainedC,
        h,
        l: constrainedL,
        mode: 'oklch',
      } as Oklch;

      const rgbColor = converter('rgb')(oklchColor);
      if (!rgbColor) {
        console.warn('Failed to convert OKLCH to RGB');
        return '#000000';
      }

      return formatHex({
        b: Math.max(0, Math.min(1, rgbColor.b)),
        g: Math.max(0, Math.min(1, rgbColor.g)),
        mode: 'rgb',
        r: Math.max(0, Math.min(1, rgbColor.r)),
      });
    } catch (error) {
      console.warn(`Color conversion error: ${error}. Falling back to black.`);
      return '#000000';
    }
  }
}

export type {
  ColorCategory,
  ColorConfig,
  ColorPalette,
  ColorProperties,
  ColorScheme,
  ColorSchemePalette,
  ColorSchemeVariant,
  ColorSemantics,
  ColorToken,
  FilteredColorScheme,
};

export { Color, colorSchemeOptions, colorVariants };
