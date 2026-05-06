import { Theme } from '../core/theme';
import { typographyTokens } from '../tokens/typography';

class SolarizedTheme extends Theme {
  protected override baseColors = {
    accent: '#859900', // Olive green
    error: '#DC322F', // Distinctive red
    info: '#6C71C4', // Soft purple
    neutral: '#93A1A1', // Existing grayish tone
    primary: '#586E75', // Subdued blue-gray
    secondary: '#93A1A1', // Light grayish tone
    success: '#2AA198', // Soft cyan
    warning: '#B58900', // Muted gold
  };
  protected override description =
    'A color palette inspired by the Solarized color scheme';
  protected override displayName = 'Solarized';
  protected override name = 'solarized';
  protected override typography = {
    fontFamily: {
      mono: typographyTokens.fontFamily.mono,
      sans: `'Fira Code', monospace,${typographyTokens.fontFamily.sans}`,
    },
  };
}

export default SolarizedTheme;
