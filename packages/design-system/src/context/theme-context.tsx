import { createRequiredContext } from '../utils/create-required-context';

interface ThemeContextValue {
  setTheme: (theme: string) => void;
  theme: string;
}

const [ThemeContext, useTheme] = createRequiredContext<ThemeContextValue>(
  'useTheme must be used within a ThemeProvider',
);

export { ThemeContext, useTheme };
export type { ThemeContextValue };
