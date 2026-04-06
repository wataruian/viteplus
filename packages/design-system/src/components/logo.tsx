import type { HTMLAttributes } from 'react';

export const Logo = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-center gap-4 group cursor-pointer ${className}`} {...props}>
    <div className='relative w-12 h-12 flex items-center justify-center transition-all duration-700 group-hover:rotate-[360deg]'>
      <div className='absolute inset-0 bg-gradient-to-tr from-primary-600 via-indigo-500 to-accent-400 rounded-2xl rotate-12 opacity-80 blur-[2px] group-hover:rotate-0 transition-transform duration-700'></div>
      <div className='absolute inset-0 bg-surface-dark border-2 border-white/20 rounded-2xl group-hover:border-primary-500 transition-colors duration-700'></div>
      <div className='relative z-10 w-6 h-6 bg-gradient-to-br from-white to-white/40 rounded-lg shadow-glow animate-pulse-slow'></div>
      <div className='absolute -top-1 -right-1 w-4 h-4 bg-accent-500 rounded-full blur-[8px] opacity-0 group-hover:opacity-100 transition-opacity duration-700'></div>
    </div>
    <div className='flex flex-col -gap-1'>
      <span className='text-2xl font-black tracking-tighter text-white font-header uppercase leading-none'>
        Light
      </span>
      <span className='text-sm font-bold tracking-[0.2em] text-primary-400 font-header uppercase leading-none opacity-80'>
        Project
      </span>
    </div>
  </div>
);
