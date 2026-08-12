import { type VariantProps, cva } from 'class-variance-authority';
import { type HTMLAttributes, forwardRef } from 'react';

import { baseStyles } from '../tokens/base';
import type { BaseComponentProps } from './base';
import { typographyStyles } from './typography';

const logoStyles = {
  base: 'flex items-center gap-2 font-black',
  default: {
    look: 'default' as const,
  },
  variants: {
    look: {
      default: {
        bottom: 'text-2xl tracking-tighter text-white',
        inner: 'flex flex-col items-start leading-compressed',
        top: baseStyles.colors.text.primary,
      },
    },
  },
} as const;

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
  ({ children, className = '', props, textBottom = '', textTop = '', useDefault = true }, ref) => {
    const finalClass = useDefault ? logoVariants({ className }) : className;

    const { look } = logoStyles.default;
    const lookStyles = logoStyles.variants.look[look];

    return (
      <div {...props} ref={ref} className={finalClass}>
        {useDefault ? (
          <div className={lookStyles.inner}>
            <span className={`${typographyStyles.variants.type.caption} ${lookStyles.top}`}>
              {textTop}
            </span>
            <span className={lookStyles.bottom}>{textBottom}</span>
          </div>
        ) : null}

        {children}
      </div>
    );
  },
);

Logo.displayName = 'Logo';

export { Logo, logoStyles };
export type { LogoProps, LogoVariants };
