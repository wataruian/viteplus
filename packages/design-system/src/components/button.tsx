import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  isLoading?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost' | 'premium' | 'outline';
}

export const Button = ({
  children,
  className = '',
  isLoading = false,
  leftIcon,
  rightIcon,
  size = 'md',
  variant = 'primary',
  ...props
}: ButtonProps) => {
  const variants = {
    ghost: 'btn-ghost',
    outline: 'btn-outline',
    premium: 'btn-premium',
    primary: 'btn-primary',
    secondary: 'btn-secondary',
  };

  const sizes = {
    lg: 'px-8 py-4 text-lg rounded-xl',
    md: 'px-6 py-3 text-base rounded-lg',
    sm: 'px-4 py-2 text-sm rounded-md',
  };

  return (
    <button
      className={`${variants[variant]} ${sizes[size]} group ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {variant === 'premium' && (
        <div className='absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer pointer-events-none' />
      )}
      {isLoading ? (
        <span className='i-ph-circle-notch-bold animate-spin text-xl'></span>
      ) : (
        <>
          {Boolean(leftIcon) && <span className={`${leftIcon} text-xl`}></span>}
          {children}
          {Boolean(rightIcon) && (
            <span
              className={`${rightIcon} text-xl transition-transform group-hover:translate-x-1`}
            ></span>
          )}
        </>
      )}
    </button>
  );
};
