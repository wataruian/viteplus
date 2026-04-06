import { Button } from './button';
import { Container } from './layout';
import { Logo } from './logo';
import type { ReactNode } from 'react';

interface HeaderProps {
  children?: ReactNode;
}

export const Header = ({ children }: HeaderProps) => (
  <nav className='glass-nav h-20 flex items-center sticky top-0 z-50 transition-all duration-300'>
    <Container className='w-full flex items-center justify-between'>
      <Logo />

      <div className='hidden md:flex items-center gap-8'>
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

      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='sm' className='hidden sm:flex'>
          <div className='i-ph-github-logo-fill mr-2'></div>
          GitHub
        </Button>
        <Button variant='premium' size='sm' className='px-6'>
          Get Started
        </Button>
      </div>
    </Container>
  </nav>
);
