import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { Logo } from './logo';
import { ModeSwitcher } from './mode-switcher';
import { ThemeSwitcher } from './theme-switcher';
import { layoutStyles } from './layout';

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
            {showThemeSwitcher && <ThemeSwitcher />}
            {showModeSwitcher && <ModeSwitcher />}
          </div>
        </div>
      </header>
    );
  },
);

Header.displayName = 'Header';

export type { HeaderProps, HeaderVariants };
export { Header, headerStyles };
