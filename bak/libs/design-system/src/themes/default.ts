import { defaultThemeBaseColors, Theme } from '../core/theme';
import { typographyTokens } from '../tokens/typography';

class DefaultTheme extends Theme {
  protected override baseColors = defaultThemeBaseColors;
  protected override description = 'A minimalistic and user-friendly theme';
  protected override displayName = 'Default';
  protected override name = 'default';
  protected override typography = {
    fontFamily: {
      mono: typographyTokens.fontFamily.mono,
      sans: `'Inter', sans-serif,${typographyTokens.fontFamily.sans}`,
    },
  };
}

export default DefaultTheme;
