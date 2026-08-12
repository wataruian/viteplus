import { type VariantProps, cva } from 'class-variance-authority';
import { baseStyles, intentSolid } from '../tokens/base';
import type { BaseComponentProps } from './base';
import { Button } from './button';
import { Icon } from './icon';
import { forwardRef } from 'react';
import { useMode } from '../context/mode-context';

const modeSwitcherStyles = {
  base: 'aspect-square flex items-center justify-center !p-0',
  default: {
    intent: 'ghost' as const,
    look: 'default' as const,
    size: 'md' as const,
  },
  variants: {
    intent: {
      accent: intentSolid('accent'),
      danger: intentSolid('danger'),
      ghost: `${baseStyles.colors.bg.transparent} ${baseStyles.colors.text.inverseSurface} hover:${baseStyles.colors.bg.adaptiveSurface} hover:${baseStyles.colors.text.inverseSurface}`,
      info: intentSolid('info'),
      inverse: `${baseStyles.colors.bg.inversePrimary} ${baseStyles.colors.text.adaptivePrimary} hover:opacity-90`,
      premium: `bg-gradient-to-br from-primary via-accent to-primary bg-[length:200%_200%] animate-gradient text-white shadow-xl ${baseStyles.colors.shadow.primary}/20 hover:scale-[1.02]`,
      primary: intentSolid('primary'),
      secondary: `${baseStyles.colors.bg.adaptiveSurface} ${baseStyles.colors.text.inverseSurface} shadow-lg ${baseStyles.colors.shadow.adaptiveSurface} hover:${baseStyles.colors.bg.inverseSurface} hover:${baseStyles.colors.text.adaptiveSurface}`,
      success: intentSolid('success'),
      warning: intentSolid('warning'),
    },
    look: {
      default: {
        moonIcon: 'i-ph-moon-bold',
        sunIcon: 'i-ph-sun-bold',
      },
    },
    size: {
      lg: 'h-14 px-8 text-lg rounded-xl',
      md: 'h-11 px-6 text-base rounded-lg',
      sm: 'h-9 px-4 text-sm rounded-md',
      xl: 'h-16 px-10 text-xl rounded-2xl',
    },
  },
} as const;

const modeSwitcherVariants = cva(modeSwitcherStyles.base, {
  defaultVariants: modeSwitcherStyles.default,
  variants: modeSwitcherStyles.variants,
});

type ModeSwitcherVariants = VariantProps<typeof modeSwitcherVariants>;

interface ModeSwitcherProps extends BaseComponentProps, ModeSwitcherVariants {
  darkIcon?: string;
  lightIcon?: string;
}

const ModeSwitcher = forwardRef<HTMLButtonElement | HTMLAnchorElement, ModeSwitcherProps>(
  ({ className = '', darkIcon, intent, lightIcon, props, size, useDefault = true }, ref) => {
    const { mode, toggleMode } = useMode();

    const finalClass = useDefault ? modeSwitcherVariants({ className, intent, size }) : className;
    const finalIntent = useDefault ? (intent ?? modeSwitcherStyles.default.intent) : intent;
    const finalSize = useDefault ? (size ?? modeSwitcherStyles.default.size) : size;

    const { look } = modeSwitcherStyles.default;
    const lookStyles = modeSwitcherStyles.variants.look[look];

    return (
      <Button
        className={finalClass}
        intent={finalIntent}
        props={{
          'aria-label': `Switch to ${mode === 'light' ? 'dark' : 'light'} mode`,
          onClick: () => {
            toggleMode();
          },
          ...props,
        }}
        ref={ref}
        size={finalSize}
      >
        <Icon
          name={
            mode === 'light' ? (lightIcon ?? lookStyles.sunIcon) : (darkIcon ?? lookStyles.moonIcon)
          }
        />
      </Button>
    );
  },
);

ModeSwitcher.displayName = 'ModeSwitcher';

export type { ModeSwitcherProps, ModeSwitcherVariants };
export { ModeSwitcher, modeSwitcherStyles };
