import type { ReactNode } from 'react';

interface MarqueeProps {
  children: ReactNode;
  direction?: 'left' | 'right';
  speed?: number;
  pauseOnHover?: boolean;
}

export const Marquee = ({
  children,
  direction = 'left',
  speed = 10,
  pauseOnHover = true,
}: MarqueeProps) => (
  <div className='group relative flex overflow-hidden py-10 w-full mask-linear-r opacity-90 hover:opacity-100 transition-opacity duration-700'>
    <div
      className={`flex min-w-full shrink-0 items-center justify-around gap-12 ${
        direction === 'left' ? 'animate-scroll-left' : 'animate-scroll-right'
      } ${pauseOnHover ? 'group-hover:pause' : ''}`}
      style={{ animationDuration: `${speed}s` }}
    >
      {children}
      {children}
    </div>
    <div
      className={`flex min-w-full shrink-0 items-center justify-around gap-12 ${
        direction === 'left' ? 'animate-scroll-left' : 'animate-scroll-right'
      } ${pauseOnHover ? 'group-hover:pause' : ''}`}
      aria-hidden='true'
      style={{ animationDuration: `${speed}s` }}
    >
      {children}
      {children}
    </div>
  </div>
);

export const MarqueeItem = ({ icon, text }: { icon: string; text: string }) => (
  <div className='flex items-center gap-4 px-8 py-4 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 hover:border-white/20 whitespace-nowrap group/item cursor-default'>
    <div
      className={`${icon} text-3xl text-slate-400 group-hover/item:text-primary-400 transition-colors duration-300`}
    ></div>
    <span className='text-lg font-semibold text-slate-500 group-hover/item:text-white transition-colors duration-300 font-header uppercase tracking-widest'>
      {text}
    </span>
  </div>
);
