import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { themes } from '../utils/theme-generator';

interface ThemeContextValue {
  setTheme: (theme: string) => void;
  theme: string;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const themeList = Object.keys(themes);
  const [theme, setTheme] = useState(themeList[0]);

  useEffect(() => {
    const root = typeof globalThis === 'undefined' ? null : globalThis.document.documentElement;
    if (root) {
      root.classList.remove(...themeList.filter((t) => t !== 'default'));

      if (theme !== 'default') {
        root.classList.add(theme);
      }
    }
  }, [theme, themeList]);

  return <ThemeContext.Provider value={{ setTheme, theme }}>{children}</ThemeContext.Provider>;
};

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export type { ThemeContextValue };
export { ThemeContext, ThemeProvider, useTheme };
