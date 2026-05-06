import { Button, type ButtonProps } from './button';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { baseStyles } from '../tokens/base';
import { forwardRef } from 'react';
import { themes } from '../utils/theme-generator';
import { useTheme } from '../context/theme-context';

const themeSwitcherStyles = {
  base: `flex flex-wrap gap-1 ${baseStyles.colors.bg.adaptiveSurface} p-1 rounded-xl border ${baseStyles.colors.border.inverseSurface}/10 shadow-sm w-fit`,
  default: {
    look: 'default' as const,
    plain: false,
    size: 'sm' as const,
  },
  variants: {
    look: {
      default: {
        activeIntent: 'inverse',
        button: 'capitalize font-medium shadow-none transition-colors',
        inactiveIntent: 'ghost',
      },
    },
    plain: {
      false: '',
      true: '!bg-transparent !border-none !shadow-none !p-0',
    },
    size: {
      lg: 'gap-2 p-2',
      md: 'gap-1.5 p-1.5',
      sm: 'gap-1 p-1',
    },
  },
} as const;

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
export { ThemeSwitcher, themeSwitcherStyles };
