import type { HTMLAttributes } from 'react';
import { Noise } from './noise';

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
  <div className='fixed inset-0 -z-20 bg-adaptive overflow-hidden pointer-events-none'>
    <Noise className='opacity-[0.03]' />
    <div className='absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-primary/10 blur-[80px] rounded-full animate-pulse-slow' />
    <div
      className='absolute bottom-[0%] right-[-10%] w-[60%] h-[60%] bg-accent/10 blur-[80px] rounded-full animate-pulse-slow'
      style={{ animationDelay: '2s' }}
    />
    <div
      className='absolute top-[30%] left-[40%] w-[30%] h-[30%] bg-primary/10 blur-[60px] rounded-full animate-float'
      style={{ animationDelay: '1s' }}
    />
    <div className='absolute inset-0 bg-gradient-to-b from-transparent via-adaptive/20 to-adaptive' />
  </div>
);
