import { type VariantProps, cva } from 'class-variance-authority';
import { type AnchorHTMLAttributes, type ButtonHTMLAttributes, forwardRef } from 'react';

import { baseStyles, intentSolid } from '../tokens/base';
import type { BaseComponentProps } from './base';

const buttonStyles = {
  base: 'inline-flex items-center justify-center font-bold tracking-tight transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
  default: {
    intent: 'primary' as const,
    size: 'md' as const,
  },
  variants: {
    intent: {
      accent: intentSolid('accent'),
      danger: intentSolid('danger'),
      ghost: `${baseStyles.colors.bg.transparent} ${baseStyles.colors.text.inverseSurface} hover:${baseStyles.colors.bg.adaptiveSurface} hover:${baseStyles.colors.text.inverseSurface}`,
      info: intentSolid('info'),
      inverse: `${baseStyles.colors.bg.inversePrimary} ${baseStyles.colors.text.adaptivePrimary} hover:opacity-90`,
      premium: `bg-gradient-to-br from-primary via-accent to-primary bg-[length:200%_200%] animate-gradient text-white shadow-xl ${baseStyles.colors.shadow.primary}/20 hover:scale-[1.02]`,
      primary: intentSolid('primary'),
      secondary: `${baseStyles.colors.bg.adaptiveSurface} ${baseStyles.colors.text.inverseSurface} shadow-lg ${baseStyles.colors.shadow.adaptiveSurface} hover:${baseStyles.colors.bg.inverseSurface} hover:${baseStyles.colors.text.adaptiveSurface}`,
      success: intentSolid('success'),
      warning: intentSolid('warning'),
    },
    size: {
      lg: 'h-14 px-8 text-lg rounded-xl',
      md: 'h-11 px-6 text-base rounded-lg',
      sm: 'h-9 px-4 text-sm rounded-md',
      xl: 'h-16 px-10 text-xl rounded-2xl',
    },
  },
} as const;

const buttonVariants = cva(buttonStyles.base, {
  defaultVariants: buttonStyles.default,
  variants: buttonStyles.variants,
});

type ButtonVariants = VariantProps<typeof buttonVariants>;

type ButtonBaseProps = ButtonHTMLAttributes<HTMLButtonElement> &
  AnchorHTMLAttributes<HTMLAnchorElement>;

interface ButtonProps extends BaseComponentProps<ButtonBaseProps>, ButtonVariants {
  href?: string | undefined;
}

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ children, className = '', href, intent, props, size, useDefault = true }, ref) => {
    const finalClass = useDefault ? buttonVariants({ className, intent, size }) : className;

    if (href !== undefined && href !== '') {
      return (
        <a
          {...props}
          ref={(node) => {
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          className={finalClass}
          href={href}
        >
          {children}
        </a>
      );
    }

    return (
      <button
        {...props}
        ref={(node) => {
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={finalClass}
        type='button'
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonStyles };
export type { ButtonBaseProps, ButtonProps, ButtonVariants };
