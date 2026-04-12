import { type VariantProps, cva } from 'class-variance-authority';
import { forwardRef, useEffect, useState } from 'react';
import type { BaseComponentProps } from '../types/component';
import { Button } from './button';
import { Icon } from './icon';
import { themeSwitcherStyles } from '../tokens/styles';

const themeSwitcherVariants = cva(themeSwitcherStyles.base, {
  defaultVariants: themeSwitcherStyles.default,
  variants: themeSwitcherStyles.variants,
});

type ThemeSwitcherVariants = VariantProps<typeof themeSwitcherVariants>;

interface ThemeSwitcherProps extends BaseComponentProps, ThemeSwitcherVariants {
  darkIcon?: string;
  lightIcon?: string;
}

const ThemeSwitcher = forwardRef<HTMLButtonElement | HTMLAnchorElement, ThemeSwitcherProps>(
  ({ className = '', darkIcon, intent, lightIcon, props, size, useDefault = false }, ref) => {
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

    const finalClass = useDefault ? themeSwitcherVariants({ className, intent, size }) : className;
    const finalIntent = useDefault ? (intent ?? themeSwitcherStyles.default.intent) : intent;
    const finalSize = useDefault ? (size ?? themeSwitcherStyles.default.size) : size;

    return (
      <Button
        className={finalClass}
        intent={finalIntent}
        props={{
          'aria-label': `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
          onClick: toggleTheme,
          ...props,
        }}
        ref={ref}
        size={finalSize}
        useDefault={useDefault}
      >
        <Icon
          name={
            theme === 'light'
              ? (lightIcon ?? themeSwitcherStyles.slots.sunIcon)
              : (darkIcon ?? themeSwitcherStyles.slots.moonIcon)
          }
          useDefault={useDefault}
        />
      </Button>
    );
  },
);

ThemeSwitcher.displayName = 'ThemeSwitcher';

export type { ThemeSwitcherProps, ThemeSwitcherVariants };
export { ThemeSwitcher, themeSwitcherVariants };
