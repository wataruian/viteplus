import type { HTMLAttributes } from 'react';

interface BeamProps extends HTMLAttributes<HTMLDivElement> {
  delay?: string;
  duration?: string;
  size?: 'sm' | 'md' | 'lg';
  top?: string;
}

export const Beam = ({
  className = '',
  delay = '0s',
  duration = '8s',
  size = 'md',
  top = '20%',
  ...props
}: BeamProps) => {
  const sizeClasses = {
    lg: 'h-[2px] w-full max-w-[600px]',
    md: 'h-[1px] w-full max-w-[400px]',
    sm: 'h-[1px] w-full max-w-[200px]',
  };

  return (
    <div
      className={`absolute left-0 overflow-hidden pointer-events-none ${className}`}
      style={{ top, ...props.style }}
    >
      <div
        className={`bg-gradient-to-r from-transparent via-primary-400/50 to-transparent animate-beam ${sizeClasses[size]}`}
        style={{
          animationDelay: delay,
          animationDuration: duration,
        }}
      />
    </div>
  );
};
