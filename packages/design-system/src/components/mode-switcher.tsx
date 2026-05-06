import { Button, buttonStyles } from './button';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
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
    intent: buttonStyles.variants.intent,
    look: {
      default: {
        moonIcon: 'i-ph-moon-bold',
        sunIcon: 'i-ph-sun-bold',
      },
    },
    size: buttonStyles.variants.size,
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
