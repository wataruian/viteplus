import { Button } from './button';
import { Container } from './layout';
import { Logo } from './logo';
import type { ReactNode } from 'react';
import { ThemeSwitcher } from './theme-switcher';

interface HeaderProps {
  children?: ReactNode;
}

export const Header = ({ children }: HeaderProps) => (
  <header className='h-20 flex items-center sticky top-0 z-50 bg-white dark:bg-[#050505] border-b border-black/10 dark:border-white/10 transition-all duration-300'>
    <Container className='w-full flex items-center justify-between gap-4'>
      <div className='flex items-center gap-8'>
        <Logo />
        <div className='hidden lg:flex items-center gap-8'>
          {children ?? (
            <>
              <a href='#features' className='nav-link'>
                Features
              </a>
              <a href='#docs' className='nav-link'>
                Docs
              </a>
              <a href='#pricing' className='nav-link'>
                Pricing
              </a>
            </>
          )}
        </div>
      </div>
      <div className='flex items-center gap-4'>
        <div className='hidden sm:block'>
          <ThemeSwitcher />
        </div>
        <Button
          variant='ghost'
          size='sm'
          className='hidden md:flex bg-inverse/5 border border-black/20 dark:border-white/20 hover:bg-adaptive-surface hover:text-inverse transition-all active:scale-90 shadow-glow'
        >
          <div className='i-ph-github-logo-fill mr-2'></div>
          GitHub
        </Button>
        <Button
          variant='premium'
          size='sm'
          className='px-6 bg-inverse/5 border border-black/20 dark:border-white/20 hover:bg-adaptive-surface hover:text-inverse transition-all active:scale-90 shadow-glow'
        >
          Get Started
        </Button>
      </div>
    </Container>
  </header>
);
