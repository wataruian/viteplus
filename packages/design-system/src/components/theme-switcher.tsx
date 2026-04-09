import { useEffect, useState } from 'react';
import type { BaseComponentProps } from '../types/component';
import { Button } from './button';
import { iconStyles } from '../tokens/variants';

type ThemeSwitcherProps = BaseComponentProps;

const ThemeSwitcher = ({ className = '', props, useDefault = true }: ThemeSwitcherProps) => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root =
      typeof globalThis === 'undefined' ? undefined : globalThis.document.documentElement;
    if (root) {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <Button
      className={className}
      intent='secondary'
      props={{
        'aria-label': `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
        onClick: toggleTheme,
        ...props,
      }}
      size='sm'
      useDefault={useDefault}
    >
      <div className={theme === 'light' ? iconStyles.sun : iconStyles.moon} />
    </Button>
  );
};

export type { ThemeSwitcherProps };
export { ThemeSwitcher };
