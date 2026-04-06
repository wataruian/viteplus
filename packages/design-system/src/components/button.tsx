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
    ghost: 'text-slate-400 hover:text-white hover:bg-white/5',
    outline:
      'bg-transparent text-white border-2 border-white/10 hover:border-white/20 hover:bg-white/5 transition-all',
    premium:
      'relative overflow-hidden bg-gradient-to-br from-primary-500 to-indigo-600 text-white hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] hover:scale-105 active:scale-100 transition-all',
    primary:
      'bg-primary-600 text-white hover:bg-primary-500 hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all',
    secondary:
      'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all',
  };

  const sizes = {
    lg: 'px-8 py-4 text-lg rounded-xl',
    md: 'px-6 py-3 text-base rounded-lg',
    sm: 'px-4 py-2 text-sm rounded-md',
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium ${variants[variant]} ${sizes[size]} ${className}`}
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
