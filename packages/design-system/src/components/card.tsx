import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'glass' | 'outline' | 'premium';
}

export const Card = ({ children, className = '', variant = 'premium', ...props }: CardProps) => {
  const baseStyles = 'rounded-2xl overflow-hidden transition-all duration-300';

  const variants = {
    default: 'bg-surface-muted border border-white/5 shadow-xl',
    glass: 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl',
    outline: 'bg-transparent border border-white/10 hover:border-primary-500/30',
    premium: 'card-premium',
  };

  const combinedClassName = `${baseStyles} ${variants[variant]} ${className}`;

  return (
    <div className={combinedClassName} {...props}>
      {children}
    </div>
  );
};

export const CardHeader = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`p-6 border-b border-white/5 ${className}`}>{children}</div>;

export const CardContent = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`p-6 ${className}`}>{children}</div>;

export const CardFooter = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`p-6 bg-white/[0.02] border-t border-white/5 ${className}`}>{children}</div>;
