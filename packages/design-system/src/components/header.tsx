import type { BaseComponentProps } from '../types/component';
import type { HTMLAttributes } from 'react';
import { Logo } from './logo';
import { ThemeSwitcher } from './theme-switcher';
import { getSlotClass } from '../utils/styles';
import { layoutStyles } from '../tokens/variants';

type HeaderProps = BaseComponentProps<HTMLAttributes<HTMLElement>>;

const Header = ({ className = '', props, useDefault = true }: HeaderProps) => {
  const finalClass = useDefault ? `${layoutStyles.header} ${className}` : className;

  return (
    <header {...props} className={getSlotClass(useDefault, finalClass, props)}>
      <div className={layoutStyles.container}>
        <div className={layoutStyles.headerInner}>
          <Logo />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
};

export type { HeaderProps };
export { Header };
