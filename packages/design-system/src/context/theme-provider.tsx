import { type ReactNode, useEffect, useState } from 'react';
import { ThemeContext } from './theme-context';
import { themes } from '../utils/theme-generator';

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

export { ThemeProvider };
