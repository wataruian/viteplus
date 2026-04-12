import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { logoStyles, typographyStyles } from '../tokens/styles';
import type { BaseComponentProps } from '../types/component';

const logoVariants = cva(logoStyles.base, {
  defaultVariants: logoStyles.default,
  variants: logoStyles.variants,
});

type LogoVariants = VariantProps<typeof logoVariants>;

interface LogoProps extends BaseComponentProps<HTMLAttributes<HTMLDivElement>>, LogoVariants {
  textBottom?: string;
  textTop?: string;
}

const Logo = forwardRef<HTMLDivElement, LogoProps>(
  ({ children, className = '', props, textBottom = '', textTop = '', useDefault = false }, ref) => {
    const finalClass = useDefault ? logoVariants({ className }) : className;

    return (
      <div {...props} ref={ref} className={finalClass}>
        {useDefault ? (
          <div className={logoStyles.slots.inner}>
            <span className={`${typographyStyles.variants.type.caption} ${logoStyles.slots.top}`}>
              {textTop}
            </span>
            <span className={logoStyles.slots.bottom}>{textBottom}</span>
          </div>
        ) : null}

        {children}
      </div>
    );
  },
);

Logo.displayName = 'Logo';

export type { LogoProps, LogoVariants };
export { Logo, logoVariants };
