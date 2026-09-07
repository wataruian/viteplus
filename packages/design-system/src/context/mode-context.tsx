import { createRequiredContext } from '../utils/create-required-context';

type Mode = 'light' | 'dark';

interface ModeContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
}

const [ModeContext, useMode] = createRequiredContext<ModeContextValue>(
  'useMode must be used within a ModeProvider',
);

export { ModeContext, useMode };
export type { Mode, ModeContextValue };
