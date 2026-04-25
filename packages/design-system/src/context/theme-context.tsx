import { createContext, useContext } from 'react';

interface ThemeContextValue {
  setTheme: (theme: string) => void;
  theme: string;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export type { ThemeContextValue };
export { ThemeContext, useTheme };
