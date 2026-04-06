import { Container, Section } from './layout';
import { Button } from './button';

interface CTAProps {
  title: string;
  subtitle: string;
  primaryAction: { text: string; onClick?: () => void };
  secondaryAction?: { text: string; onClick?: () => void };
}

export const CTA = ({ title, subtitle, primaryAction, secondaryAction }: CTAProps) => (
  <Section className='bg-surface-dark overflow-hidden'>
    <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10'>
      <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-br from-primary-600/20 via-indigo-600/15 to-transparent blur-[120px] rounded-full animate-pulse-slow opacity-60'></div>
    </div>

    <Container className='relative z-10 text-center py-20 bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-[4rem] px-8 md:px-24 overflow-hidden border-premium'>
      <div className='absolute inset-0 opacity-10 bg-[url("https://grainy-gradients.vercel.app/noise.svg")] pointer-events-none mix-blend-overlay'></div>

      <div className='max-w-4xl mx-auto'>
        <h2 className='text-5xl md:text-8xl font-black text-white mb-10 font-header leading-[0.95] tracking-tight animate-reveal'>
          {title}
        </h2>
        <p className='text-xl md:text-2xl text-slate-400 mb-14 leading-relaxed animate-reveal delay-200'>
          {subtitle}
        </p>

        <div className='flex flex-wrap items-center justify-center gap-8 animate-reveal delay-300'>
          <Button
            variant='premium'
            size='lg'
            className='min-w-[240px] h-16 text-xl shadow-glow scale-110 hover:scale-115 active:scale-105'
            onClick={primaryAction.onClick}
          >
            {primaryAction.text}
          </Button>
          {secondaryAction && (
            <Button
              variant='secondary'
              size='lg'
              className='min-w-[240px] h-16 text-xl'
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.text}
            </Button>
          )}
        </div>
      </div>
    </Container>
  </Section>
);
