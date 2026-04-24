import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { Button } from './button';
import { Icon } from './icon';
import { forwardRef } from 'react';
import { modeSwitcherStyles } from '../tokens/styles';
import { useMode } from '../context/mode-context';

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
            mode === 'light'
              ? (lightIcon ?? modeSwitcherStyles.slots['sun-icon'])
              : (darkIcon ?? modeSwitcherStyles.slots['moon-icon'])
          }
        />
      </Button>
    );
  },
);

ModeSwitcher.displayName = 'ModeSwitcher';

export type { ModeSwitcherProps, ModeSwitcherVariants };
export { ModeSwitcher };
