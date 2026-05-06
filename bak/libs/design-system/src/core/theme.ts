import type { Typography } from '../tokens/typography';
import type { ColorConfig, ColorPalette } from './color';

import { Color } from './color';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
type ThemeName = (typeof themes)[number];
interface ThemeProps<T extends keyof ColorPalette = keyof ColorPalette> {
  baseColors: Pick<ColorPalette, T>;
  description: string;
  designTokens: ColorConfig;
  displayName: string;
  instance: Theme;
  name: string | ThemeName;
  typography: Omit<Typography, 'fontSize' | 'fontWeight' | 'lineHeight'>;
}

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------
const themes = ['default', 'solarized'] as const;
const defaultThemeBaseColors: ColorPalette = {
  accent: '#28A745', // Energetic green
  error: '#DC3545', // Red
  info: '#17A2B8', // Blue
  neutral: '#6C757D', // Neutral gray
  primary: '#007BFF', // Bright blue
  secondary: '#6C757D', // Neutral gray
  success: '#28A745', // Green
  warning: '#FFC107', // Yellow
} as const;

// ----------------------------------------------------------------------------
// THEME ABSTRACT CLASS
// ----------------------------------------------------------------------------
abstract class Theme {
  protected abstract baseColors: ColorPalette;
  protected abstract description: ThemeProps['description'];
  protected abstract displayName: ThemeProps['displayName'];
  protected abstract name: ThemeProps['name'];
  protected abstract typography: ThemeProps['typography'];

  protected constructor(name: ThemeName) {
    if (!themes.includes(name)) {
      throw new Error(`Theme ${name} not found`);
    }
  }

  static async generateTheme(name: ThemeName): Promise<ThemeProps> {
    if (!themes.includes(name)) {
      throw new Error(`Theme ${name} not found`);
    }

    const themeModule = await import(`../themes/${name}.ts`);
    const themeInstance = new themeModule.default(name);

    const { name: themeName, baseColors } = themeInstance;

    const colorGenerator = new Color(themeName, baseColors);

    const designTokens = colorGenerator.getDesignTokens();

    return {
      baseColors,
      description: themeInstance.description,
      designTokens,
      displayName: themeInstance.displayName,
      instance: themeInstance,
      name: themeName,
      typography: themeInstance.typography,
    };
  }

  static async generateThemes(): Promise<ThemeProps[]> {
    const generatedThemes: ThemeProps[] = [];
    for (const theme of themes) {
      generatedThemes.push(await Theme.generateTheme(theme));
    }
    return generatedThemes;
  }
}

export type { ThemeName, ThemeProps };

export { defaultThemeBaseColors, Theme, themes };
