import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { type Mode, ModeContext } from './mode-context';

const ModeProvider = ({
  children,
  initialMode = 'dark',
}: {
  children: ReactNode;
  initialMode?: Mode;
}) => {
  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const root = globalThis.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode, toggleMode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};

export { ModeProvider };
