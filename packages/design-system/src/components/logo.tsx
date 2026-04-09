import { featureStyles, typographyStyles } from '../tokens/variants';
import type { BaseComponentProps } from '../types/component';
import type { HTMLAttributes } from 'react';
import { getSlotClass } from '../utils/styles';

interface LogoProps extends BaseComponentProps<HTMLAttributes<HTMLDivElement>> {
  textBottom?: string;
  textTop?: string;
}

const Logo = ({
  children,
  className = '',
  props,
  textBottom = 'plus',
  textTop = 'vite',
  useDefault = true,
}: LogoProps) => {
  const finalClass = useDefault ? `${featureStyles.logo.root} ${className}` : className;

  return (
    <div {...props} className={getSlotClass(useDefault, finalClass, props)}>
      {useDefault ? (
        <div className={featureStyles.logo.inner}>
          <span className={`${typographyStyles.caption} ${featureStyles.logo.top}`}>{textTop}</span>
          <span className={featureStyles.logo.bottom}>{textBottom}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
};

export type { LogoProps };
export { Logo };
