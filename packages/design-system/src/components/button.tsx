import { type AnchorHTMLAttributes, type ButtonHTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { buttonStyles } from '../tokens/styles';

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
  ({ children, className = '', href, intent, props, size, useDefault = false }, ref) => {
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

export type { ButtonBaseProps, ButtonProps, ButtonVariants };
export { Button, buttonVariants };
