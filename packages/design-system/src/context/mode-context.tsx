import { createContext, useContext } from 'react';

type Mode = 'light' | 'dark';

interface ModeContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

const useMode = () => {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};

export { ModeContext, useMode };
export type { Mode, ModeContextValue };
