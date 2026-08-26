import { type VariantProps, cva } from 'class-variance-authority';
import { type HTMLAttributes, forwardRef } from 'react';

import type { BaseComponentProps } from './base';
import { layoutStyles } from './layout';
import { Logo } from './logo';
import { ModeSwitcher } from './mode-switcher';
import { ThemeSwitcher } from './theme-switcher';

const headerStyles = {
  base: 'fixed top-0 left-0 right-0 z-50 h-20 bg-black/40 backdrop-blur-xl border-b border-white/5',
  default: {
    look: 'default' as const,
  },
  variants: {
    look: {
      default: {
        inner: 'h-full flex items-center justify-between',
      },
    },
  },
} as const;

const headerVariants = cva(headerStyles.base, {
  defaultVariants: headerStyles.default,
  variants: headerStyles.variants,
});

type HeaderVariants = VariantProps<typeof headerVariants>;

interface HeaderProps extends BaseComponentProps<HTMLAttributes<HTMLElement>>, HeaderVariants {
  showLogo?: boolean;
  showModeSwitcher?: boolean;
  showThemeSwitcher?: boolean;
}

const Header = forwardRef<HTMLElement, HeaderProps>(
  (
    {
      children,
      className = '',
      props,
      showLogo = true,
      showModeSwitcher = true,
      showThemeSwitcher = true,
      useDefault = true,
    },
    ref,
  ) => {
    const finalClass = useDefault ? headerVariants({ className }) : className;

    const { look } = headerStyles.default;
    const lookStyles = headerStyles.variants.look[look];

    return (
      <header {...props} ref={ref} className={finalClass}>
        <div className={layoutStyles.variants.type.container}>
          <div className={lookStyles.inner}>
            {showLogo && <Logo />}
            {children}
            {showThemeSwitcher && <ThemeSwitcher />}
            {showModeSwitcher && <ModeSwitcher />}
          </div>
        </div>
      </header>
    );
  },
);

Header.displayName = 'Header';

export { Header, headerStyles };
export type { HeaderProps, HeaderVariants };
