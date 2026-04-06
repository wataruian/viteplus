import { Container, Section } from './layout';
import { Badge } from './badge';
import { Button } from './button';
import type { ReactNode } from 'react';

interface HeroProps {
  title: string | ReactNode;
  subtitle: string;
  badge?: string;
  primaryAction?: { text: string; onClick?: () => void };
  secondaryAction?: { text: string; onClick?: () => void };
}

export const Hero = ({ title, subtitle, badge, primaryAction, secondaryAction }: HeroProps) => (
  <Section className='pt-40 pb-24 overflow-hidden relative min-h-[90vh] flex items-center'>
    <div className='absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-full -z-10'>
      <div className='absolute top-[-15%] left-[-15%] w-[70%] h-[70%] bg-primary-600/10 blur-[150px] rounded-full animate-pulse-slow'></div>
      <div
        className='absolute bottom-[5%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[130px] rounded-full animate-pulse-slow'
        style={{ animationDelay: '2s' }}
      ></div>
    </div>

    <Container className='text-center relative z-10'>
      {Boolean(badge) && (
        <div className='animate-reveal'>
          <Badge
            variant='accent'
            size='lg'
            className='mb-10 shadow-glow bg-white/5 border-white/20 px-6 py-2 tracking-wide'
          >
            {badge}
          </Badge>
        </div>
      )}

      <h1
        className='text-7xl md:text-[120px] font-black mb-10 leading-[0.85] tracking-tighter text-white font-header animate-reveal'
        style={{ animationDelay: '0.1s' }}
      >
        {title}
      </h1>

      <p
        className='text-xl md:text-2xl text-slate-400 max-w-4xl mx-auto mb-14 leading-relaxed animate-reveal'
        style={{ animationDelay: '0.2s' }}
      >
        {subtitle}
      </p>

      <div
        className='flex flex-wrap items-center justify-center gap-6 animate-reveal'
        style={{ animationDelay: '0.3s' }}
      >
        {primaryAction && (
          <Button
            variant='premium'
            size='lg'
            className='min-w-[200px] h-14 text-lg shadow-glow'
            onClick={primaryAction.onClick}
          >
            {primaryAction.text}
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant='ghost'
            size='lg'
            className='min-w-[200px] h-14 text-lg border border-white/10'
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.text}
          </Button>
        )}
      </div>
    </Container>
  </Section>
);
