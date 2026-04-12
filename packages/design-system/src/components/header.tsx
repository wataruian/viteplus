import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { Logo } from './logo';
import { ThemeSwitcher } from './theme-switcher';
import { layoutStyles } from '../tokens/styles';

const headerVariants = cva(layoutStyles.base, {
  defaultVariants: {
    type: 'header',
  },
  variants: layoutStyles.variants,
});

type HeaderVariants = VariantProps<typeof headerVariants>;

interface HeaderProps extends BaseComponentProps<HTMLAttributes<HTMLElement>>, HeaderVariants {}

const Header = forwardRef<HTMLElement, HeaderProps>(
  ({ className = '', props, useDefault = true }, ref) => {
    const finalClass = useDefault ? headerVariants({ className, type: 'header' }) : className;

    return (
      <header {...props} ref={ref} className={finalClass}>
        <div className={layoutStyles.variants.type.container}>
          <div className={layoutStyles.variants.type.headerInner}>
            <Logo />
            <ThemeSwitcher />
          </div>
        </div>
      </header>
    );
  },
);

Header.displayName = 'Header';

export type { HeaderProps, HeaderVariants };
export { Header, headerVariants };
