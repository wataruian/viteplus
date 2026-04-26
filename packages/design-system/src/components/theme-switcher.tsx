import { Button, type ButtonProps } from './button';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
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

    const { look } = themeSwitcherStyles.default;
    const lookStyles = themeSwitcherStyles.variants.look[look];

    return (
      <div {...props} ref={ref} className={finalClass}>
        {themeList.map((t) => (
          <Button
            key={t}
            intent={
              (theme === t
                ? lookStyles.activeIntent
                : lookStyles.inactiveIntent) as ButtonProps['intent']
            }
            size={size}
            props={{
              onClick: () => {
                setTheme(t);
              },
            }}
            className={lookStyles.button}
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
