import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { headerStyles, layoutStyles } from '../tokens/styles';
import type { BaseComponentProps } from '../types/component';
import { Logo } from './logo';
import { ModeSwitcher } from './mode-switcher';
import { ThemeSwitcher } from './theme-switcher';

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
export { Header };
