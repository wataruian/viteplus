import type { HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: 'primary' | 'accent' | 'danger' | 'info' | 'success' | 'warning' | 'outline' | 'glass';
  size?: 'sm' | 'md' | 'lg';
}

export const Badge = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  ...props
}: BadgeProps) => {
  const variants = {
    accent: 'bg-accent/10 text-accent border-accent/20 shadow-[0_0_15px_rgba(var(--accent),0.1)]',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    glass: 'bg-white/5 text-white border-white/10 backdrop-blur-md shadow-inner',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    outline: 'bg-transparent text-slate-400 border-white/10',
    primary:
      'bg-primary/10 text-primary border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  const sizes = {
    lg: 'px-4 py-1.5 text-sm',
    md: 'px-3 py-1 text-xs',
    sm: 'px-2.5 py-0.5 text-[10px]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold tracking-wide uppercase rounded-full border transition-all duration-300 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {variant === 'accent' && (
        <span className='relative flex h-2 w-2'>
          <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75'></span>
          <span className='relative inline-flex rounded-full h-2 w-2 bg-accent-500'></span>
        </span>
      )}
      {children}
    </span>
  );
};
