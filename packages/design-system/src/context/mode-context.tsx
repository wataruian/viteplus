import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';

type Mode = 'light' | 'dark';

interface ModeContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

const ModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<Mode>('dark');

  useEffect(() => {
    const root = typeof globalThis === 'undefined' ? null : globalThis.document.documentElement;
    if (root) {
      root.classList.remove('light', 'dark');
      root.classList.add(mode);
    }
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>{children}</ModeContext.Provider>
  );
};

const useMode = () => {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};

export type { ModeContextValue };
export { ModeContext, ModeProvider, useMode };
