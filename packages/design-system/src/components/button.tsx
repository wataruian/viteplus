import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'premium' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) => {
  const variants = {
    ghost: 'text-slate-400 hover:text-white hover:bg-white/5',
    outline:
      'bg-transparent text-white border-2 border-white/10 hover:border-white/20 hover:bg-white/5',
    premium:
      'bg-gradient-to-br from-primary-500 to-indigo-600 text-white hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] hover:scale-105 active:scale-100',
    primary:
      'bg-primary-600 text-white hover:bg-primary-500 hover:shadow-[0_0_25px_rgba(139,92,246,0.5)]',
    secondary:
      'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20',
  };

  const sizes = {
    lg: 'px-8 py-4 text-lg',
    md: 'px-6 py-3 text-base',
    sm: 'px-4 py-2 text-sm',
  };

  return (
    <button className={`btn-base ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};
