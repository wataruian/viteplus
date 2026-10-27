import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { type Themes, defaultThemes } from '../tokens/themes';
import { ThemeContext } from './theme-context';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
  themes?: Themes;
}

const ThemeProvider = ({ children, defaultTheme, themes = defaultThemes }: ThemeProviderProps) => {
  const themeList = useMemo(() => Object.keys(themes), [themes]);
  if (defaultTheme !== undefined && !themeList.includes(defaultTheme)) {
    throw new Error(`defaultTheme "${defaultTheme}" is not one of: ${themeList.join(', ')}`);
  }
  const [theme, setTheme] = useState(defaultTheme ?? themeList[0]);

  useEffect(() => {
    const root = globalThis.document.documentElement;
    root.classList.remove(...themeList);
    root.classList.add(theme);
  }, [theme, themeList]);

  const value = useMemo(() => ({ setTheme, theme, themes: themeList }), [theme, themeList]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export { ThemeProvider };
export type { ThemeProviderProps };
