import { ButtonStyleClass } from '../components/atoms/button/button';
import { TextStyleClass } from '../components/atoms/text/text';
import { LayoutStyleClass } from '../components/molecules/layout/layout';
import { SelectStyleClass } from '../components/molecules/select/select';
import type { ColorToken } from '../core/color';
import { Theme, type ThemeName } from '../core/theme';
import { type Breakpoint, breakpoints } from '../tokens/breakpoints';
import { type Typography, typographyTokens } from '../tokens/typography';
import { getAllStyleClasses } from './extractor';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
interface DesignSystemConfig {
  classes: string[];
  css: string;
  instance: {
    [Key in ThemeName]?: Theme;
  };
  theme: {
    breakpoints: Breakpoint;
    colors: Partial<ColorToken> & { [Key in ThemeName]?: Partial<ColorToken> };
    fonts: Typography;
  };
}

// ----------------------------------------------------------------------------
// FUNCTIONS
// ----------------------------------------------------------------------------
const initializeTheme = async (name: ThemeName) => {
  return await Theme.generateTheme(name);
};

const initializeThemes = async () => {
  return await Theme.generateThemes();
};

const initializeDesignSystem = async () => {
  const styles = {
    button: ButtonStyleClass,
    layout: LayoutStyleClass,
    select: SelectStyleClass,
    text: TextStyleClass,
  };

  // Example: If layoutStyles is forcing flex or container widths, remove or override them.
  // layoutStyles.container = ''; // or override with display: block styles

  const themes = await initializeThemes();
  const instance = Object.fromEntries(
    themes.map(theme => [theme.name, theme.instance])
  );

  const colorsArray: DesignSystemConfig['theme']['colors'][] = [];

  const defaultTheme = themes.find(theme => theme.name === 'default');
  if (defaultTheme?.designTokens?.colors) {
    colorsArray.push({
      ...defaultTheme.designTokens.colors,
    });
  }

  const cssArray: string[] = [];
  const classesArray = [...getAllStyleClasses(styles)];

  for (const theme of themes) {
    classesArray.push(...theme.designTokens.classes);
    cssArray.push(theme.designTokens.css);
    if (theme.name && theme.designTokens && theme.designTokens.colors) {
      colorsArray.push({
        [theme.name]: theme.designTokens.colors,
      });
    }
  }

  const colors: DesignSystemConfig['theme']['colors'] = Object.assign(
    {},
    ...new Set(colorsArray)
  );
  const classes = [...new Set(classesArray)];
  const css = [...new Set(cssArray)].join('\n');

  const designSystemConfig: DesignSystemConfig = {
    classes,
    css,
    instance,
    theme: {
      breakpoints,
      colors,
      fonts: typographyTokens,
    },
  };

  return designSystemConfig;
};

export type { DesignSystemConfig };
export { initializeDesignSystem, initializeTheme, initializeThemes };
