import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { Button } from './button';
import { forwardRef } from 'react';
import { themeSwitcherStyles } from '../tokens/styles';
import { themes } from '../utils/theme-generator';
import { useTheme } from '../context/theme-context';

const themeSwitcherVariants = cva(themeSwitcherStyles.base, {
  defaultVariants: themeSwitcherStyles.default,
  variants: themeSwitcherStyles.variants,
});

type ThemeSwitcherVariants = VariantProps<typeof themeSwitcherVariants>;

interface ThemeSwitcherProps extends BaseComponentProps, ThemeSwitcherVariants {}

const ThemeSwitcher = forwardRef<HTMLDivElement, ThemeSwitcherProps>(
  ({ className = '', plain, props, size, useDefault = true }, ref) => {
    const themeList = Object.keys(themes);
    const { setTheme, theme } = useTheme();

    const finalClass = useDefault
      ? themeSwitcherVariants({
          className,
          plain: plain ?? themeSwitcherStyles.default.plain,
          size,
        })
      : className;

    return (
      <div {...props} ref={ref} className={finalClass}>
        {themeList.map((t) => (
          <Button
            key={t}
            intent={
              theme === t
                ? themeSwitcherStyles.slots['active-intent']
                : themeSwitcherStyles.slots['inactive-intent']
            }
            size={size}
            props={{
              onClick: () => {
                setTheme(t);
              },
            }}
            className={themeSwitcherStyles.slots.button}
          >
            {t}
          </Button>
        ))}
      </div>
    );
  },
);

ThemeSwitcher.displayName = 'ThemeSwitcher';

export type { ThemeSwitcherProps, ThemeSwitcherVariants };
export { ThemeSwitcher };
