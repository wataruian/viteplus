import { type ReactNode, useEffect, useState } from 'react';

import { type Mode, ModeContext } from './mode-context';

const ModeProvider = ({
  children,
  initialMode = 'light',
}: {
  children: ReactNode;
  initialMode?: Mode;
}) => {
  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

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

export { ModeProvider };
