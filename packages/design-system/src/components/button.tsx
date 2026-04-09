import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { buttonStyles } from '../tokens/variants';
import { getSlotClass } from '../utils/styles';

const buttonVariants = cva(buttonStyles.base, {
  defaultVariants: buttonStyles.defaultVariants,
  variants: buttonStyles.variants,
});

type ButtonVariants = VariantProps<typeof buttonVariants>;

type ButtonBaseProps = ButtonHTMLAttributes<HTMLButtonElement> &
  AnchorHTMLAttributes<HTMLAnchorElement>;

interface ButtonProps extends BaseComponentProps<ButtonBaseProps>, ButtonVariants {
  href?: string | undefined;
}

const Button = ({
  children,
  className = '',
  href,
  intent,
  props,
  size,
  useDefault = true,
}: ButtonProps) => {
  const finalClass = useDefault ? buttonVariants({ className, intent, size }) : className;

  if (href !== undefined && href !== '') {
    return (
      <a {...props} className={getSlotClass(useDefault, finalClass, props)} href={href}>
        {children}
      </a>
    );
  }

  return (
    <button {...props} className={getSlotClass(useDefault, finalClass, props)} type='button'>
      {children}
    </button>
  );
};

export type { ButtonBaseProps, ButtonProps, ButtonVariants };
export { Button, buttonVariants };
