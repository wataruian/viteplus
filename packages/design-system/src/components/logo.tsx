import type { HTMLAttributes } from 'react';

export const Logo = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-center gap-4 group cursor-pointer ${className}`} {...props}>
    <div className='relative w-12 h-12 flex items-center justify-center transition-all duration-700 group-hover:rotate-[360deg]'>
      <div className='absolute inset-0 bg-gradient-to-tr from-primary-600 via-primary-400 to-accent rounded-2xl rotate-12 opacity-80 blur-[2px] group-hover:rotate-0 transition-transform duration-700'></div>
      <div className='absolute inset-0 bg-adaptive-bg border-2 border-black/10 dark:border-white/20 rounded-2xl group-hover:border-primary transition-colors duration-700'></div>
      <div className='relative z-10 w-6 h-6 bg-adaptive-surface rounded-lg shadow-glow animate-pulse-slow'></div>
      <div className='absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full blur-[8px] opacity-0 group-hover:opacity-100 transition-opacity duration-700'></div>
    </div>
    <div className='flex flex-col -gap-1'>
      <span className='text-2xl font-extrabold tracking-tighter text-primary font-header uppercase leading-none opacity-90'>
        Light
      </span>
      <span className='text-sm font-bold tracking-[0.2em] text-primary font-header uppercase leading-none opacity-70'>
        Project
      </span>
    </div>
  </div>
);
