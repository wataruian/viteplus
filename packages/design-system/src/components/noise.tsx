import type { HTMLAttributes } from 'react';

export const Noise = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`absolute inset-0 w-full h-full pointer-events-none opacity-[0.03] mix-blend-overlay ${className}`}
    style={{
      backgroundImage: `url('https://grainy-gradients.vercel.app/noise.svg')`,
    }}
    {...props}
  />
);
