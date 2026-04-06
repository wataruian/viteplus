import type { HTMLAttributes } from 'react';

export const Container = ({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={`max-w-[1400px] mx-auto px-6 md:px-10 ${className}`} {...props}>
    {children}
  </div>
);

export const Section = ({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) => (
  <section className={`py-24 md:py-40 relative overflow-hidden ${className}`} {...props}>
    {children}
  </section>
);

export const Navbar = ({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) => (
  <nav className={`glass-nav h-20 flex items-center ${className}`} {...props}>
    <Container className='w-full flex items-center justify-between'>{children}</Container>
  </nav>
);

export const MeshBackground = () => (
  <div className='fixed inset-0 -z-10 bg-surface-dark overflow-hidden'>
    <div className='absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-primary-600/15 blur-[150px] rounded-full animate-pulse-slow'></div>
    <div
      className='absolute bottom-[0%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[130px] rounded-full animate-pulse-slow'
      style={{ animationDelay: '2s' }}
    ></div>
    <div
      className='absolute top-[30%] left-[40%] w-[30%] h-[30%] bg-accent-500/5 blur-[100px] rounded-full animate-float'
      style={{ animationDelay: '1s' }}
    ></div>
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-25 mix-blend-overlay pointer-events-none"></div>
    <div className='absolute inset-0 bg-gradient-to-b from-transparent via-surface-dark/50 to-surface-dark pointer-events-none'></div>
  </div>
);
