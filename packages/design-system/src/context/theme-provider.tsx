import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { themes } from '../utils/theme-generator';
import { ThemeContext } from './theme-context';

const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const themeList = Object.keys(themes);
  const [theme, setTheme] = useState(themeList[0]);

  useEffect(() => {
    const root = globalThis.document.documentElement;
    root.classList.remove(...themeList.filter((t) => t !== 'default'));

    if (theme !== 'default') {
      root.classList.add(theme);
    }
  }, [theme, themeList]);

  const value = useMemo(() => ({ setTheme, theme }), [setTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export { ThemeProvider };
