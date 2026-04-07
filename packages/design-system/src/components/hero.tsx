import { Container, Section } from './layout';
import { Badge } from './badge';
import { Beam } from './beam';
import { Button } from './button';
import { Noise } from './noise';
import type { ReactNode } from 'react';

interface HeroProps {
  title: string | ReactNode;
  subtitle: string;
  badge?: string;
  primaryAction?: { text: string; onClick?: () => void };
  secondaryAction?: { text: string; onClick?: () => void };
}

export const Hero = ({ title, subtitle, badge, primaryAction, secondaryAction }: HeroProps) => (
  <Section className='pt-40 pb-24 overflow-hidden relative min-h-[90vh] flex items-center bg-surface-dark'>
    <Noise className='opacity-[0.02]' />
    <div className='absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary),0.1),transparent_70%)]' />

    <div className='absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-full -z-10 pointer-events-none'>
      <div className='absolute top-[-5%] left-[-10%] w-[60%] h-[60%] bg-primary/5 blur-[100px] rounded-full animate-pulse-slow' />
      <div
        className='absolute bottom-[5%] right-[-5%] w-[50%] h-[50%] bg-accent/5 blur-[100px] rounded-full animate-pulse-slow'
        style={{ animationDelay: '2s' }}
      />
      <Beam top='15%' delay='0s' duration='10s' size='lg' />
      <Beam top='35%' delay='3s' duration='12s' size='md' className='opacity-50' />
      <Beam top='65%' delay='6s' duration='8s' size='sm' className='opacity-30' />
    </div>

    <Container className='text-center relative z-10'>
      {Boolean(badge) && (
        <div className='animate-reveal'>
          <Badge
            variant='accent'
            size='lg'
            className='mb-10 bg-white/5 border-white/10 px-6 py-2 tracking-wide font-bold'
          >
            {badge}
          </Badge>
        </div>
      )}

      <h1
        className='text-6xl md:text-[min(120px,12vw)] font-black mb-10 leading-[0.9] tracking-tighter text-white font-header animate-reveal'
        style={{ animationDelay: '0.1s' }}
      >
        {title}
      </h1>

      <p
        className='text-xl md:text-2xl text-slate-400 max-w-4xl mx-auto mb-14 leading-relaxed animate-reveal font-medium'
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
            className='min-w-[220px] h-16 text-xl shadow-glow'
            rightIcon='i-ph-arrow-right-bold'
            onClick={primaryAction.onClick}
          >
            {primaryAction.text}
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant='ghost'
            size='lg'
            className='min-w-[220px] h-16 text-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.text}
          </Button>
        )}
      </div>
    </Container>
  </Section>
);
