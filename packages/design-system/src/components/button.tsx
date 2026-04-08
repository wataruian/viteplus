import type { HTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { getSlotClass } from '../utils/styles';

export interface ButtonProps {
  children?: ReactNode | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
  href?: string | undefined;
  isLoading?: boolean | undefined;
  leftIcon?: string | undefined;
  leftIconProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  onClick?: MouseEventHandler<HTMLElement> | undefined;
  props?: HTMLAttributes<HTMLElement> | undefined;
  rightIcon?: string | undefined;
  rightIconProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  shimmerProps?: HTMLAttributes<HTMLDivElement> | undefined;
  size?: 'sm' | 'md' | 'lg' | undefined;
  spinnerProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  useDefault?: boolean | undefined;
  variant?: 'primary' | 'secondary' | 'ghost' | 'premium' | 'outline' | undefined;
}

export const defaultInternalClasses = {
  leftIcon: 'text-xl',
  rightIcon: 'text-xl transition-transform group-hover:translate-x-1',
  shimmer:
    'absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full pointer-events-none',
  spinner: 'i-ph-circle-notch-bold animate-spin text-xl',
};

export const variants = {
  base: 'inline-flex items-center justify-center gap-2 font-bold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
  ghost: 'bg-transparent hover:scale-110 hover:bg-primary/10 hover:text-primary',
  outline: 'border-2 border-primary text-primary hover:scale-110 hover:bg-primary/5',
  premium:
    'bg-gradient-to-r from-primary to-accent text-white hover:scale-110 hover:shadow-[0_0_40px_rgba(var(--primary-base),0.4)] relative overflow-hidden',
  primary: 'bg-primary text-white',
  secondary: 'bg-accent text-white',
} as const;

export const sizes = {
  lg: 'px-8 py-4 text-lg rounded-xl',
  md: 'px-6 py-3 text-base rounded-lg',
  sm: 'px-4 py-2 text-sm rounded-md',
} as const;

export const defaultClasses =
  'group cursor-pointer flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

export const Button = ({
  children,
  className = '',
  disabled,
  href,
  isLoading = false,
  leftIcon,
  leftIconProps,
  rightIcon,
  rightIconProps,
  shimmerProps,
  size = 'md',
  spinnerProps,
  useDefault = true,
  variant = 'primary',
  onClick,
  props: rootProps,
}: ButtonProps) => {
  const finalClassName = useDefault
    ? `${variants[variant]} ${sizes[size]} ${defaultClasses} ${className}`
    : className;

  const Component = href === undefined ? 'button' : 'a';
  const isButton = Component === 'button';

  return (
    <Component
      {...rootProps}
      className={getSlotClass(useDefault, finalClassName, rootProps)}
      {...(isButton ? { disabled: isLoading || disabled, type: 'button' } : { href })}
      onClick={onClick}
    >
      {variant === 'premium' && useDefault && (
        <div
          {...shimmerProps}
          className={getSlotClass(useDefault, defaultInternalClasses.shimmer, shimmerProps)}
        />
      )}
      {isLoading ? (
        <span
          {...spinnerProps}
          className={getSlotClass(useDefault, defaultInternalClasses.spinner, spinnerProps)}
        ></span>
      ) : (
        <>
          {Boolean(leftIcon) && (
            <span
              {...leftIconProps}
              className={getSlotClass(
                useDefault,
                `${leftIcon} ${defaultInternalClasses.leftIcon}`,
                leftIconProps,
              )}
            ></span>
          )}
          {children}
          {Boolean(rightIcon) && (
            <span
              {...rightIconProps}
              className={getSlotClass(
                useDefault,
                `${rightIcon} ${defaultInternalClasses.rightIcon}`,
                rightIconProps,
              )}
            ></span>
          )}
        </>
      )}
    </Component>
  );
};
