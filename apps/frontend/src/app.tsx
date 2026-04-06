import {
  CTA,
  Features,
  Footer,
  Header,
  Hero,
  Marquee,
  MarqueeItem,
  MeshBackground,
  Terminal,
} from '@lightproject/design-system';
import { logger, samples } from '@lightproject/common';
import { useEffect } from 'react';

const App = () => {
  useEffect(() => {
    logger.info('Light Project Website - Unified Toolchain Experience', {
      theme: 'Premium Dark',
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <div className='min-h-screen bg-surface-dark text-slate-200 font-sans selection:bg-primary-500/30 overflow-x-hidden'>
      <MeshBackground />
      <Header />

      <main>
        <Hero
          badge='✨ Introducing Vite+ v2.0'
          title={
            <>
              The <span className='text-gradient-primary glow-text-primary'>Unified</span> <br />
              Toolchain
            </>
          }
          subtitle={`${samples.hello.greet()} Experience the most powerful unified toolchain ever built. Zero-config, monorepo-native, and engineered for high-performance teams.`}
          primaryAction={{ text: 'Start Building' }}
          secondaryAction={{ text: 'Book a Demo' }}
        />

        <Marquee direction='left' speed={30}>
          <MarqueeItem icon='i-logos-vitejs' text='Vite' />
          <MarqueeItem icon='i-ph-cube-duotone' text='Rolldown' />
          <MarqueeItem icon='i-logos-vitest' text='Vitest' />
          <MarqueeItem icon='i-ph-seal-check-duotone' text='Oxlint' />
          <MarqueeItem icon='i-ph-brackets-curly-duotone' text='tsdown' />
          <MarqueeItem icon='i-ph-terminal-window-duotone' text='Vite Task' />
        </Marquee>

        <section className='section-container'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-20 items-center'>
            <div className='animate-reveal'>
              <h2 className='text-5xl md:text-7xl font-black text-white mb-8 font-header leading-tight'>
                Engineered for <br />
                <span className='text-gradient-primary'>Developer Velocity</span>
              </h2>
              <p className='text-xl text-slate-400 mb-10 leading-relaxed'>
                Vite+ wraps the world's fastest tools into a single, cohesive CLI. Say goodbye to
                complex configurations and context switching.
              </p>
              <ul className='space-y-6'>
                {[
                  'Instant HMR under 50ms',
                  'Universal Task Caching',
                  'Built-in Type-Aware Linting',
                  'Monorepo-Native Architecture',
                ].map((item, idx) => (
                  <li key={idx} className='flex items-center gap-4 text-slate-300 text-lg group'>
                    <div className='w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center group-hover:bg-primary-500/40 transition-colors'>
                      <span className='i-ph-check-bold text-xs text-primary-400'></span>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className='animate-reveal' style={{ animationDelay: '0.2s' }}>
              <Terminal
                commands={[
                  {
                    command: 'vp check',
                    output: ['✔ Format (oxfmt) done', '✔ Lint (oxlint) done', '✔ Type check done'],
                  },
                  {
                    command: 'vp test',
                    output: [
                      'RUN  v2.0.0',
                      '✓ tests/e2e.test.ts',
                      'Test Files  1 passed',
                      'Tests  12 passed',
                    ],
                  },
                  {
                    command: 'vp dev',
                    output: ['➜ Vite+ Dev Server', '➜ Local: http://localhost:3000', '➜ HMR Ready'],
                  },
                ]}
              />
            </div>
          </div>
        </section>

        <Features
          title='World-Class Features'
          subtitle='Every tool you need, unified into a single, cohesive experience.'
          features={[
            {
              description:
                'Proprietary Hot Module Replacement that stays under 50ms even in massive monorepos.',
              icon: 'i-ph-lightning-fill',
              span: 'md:col-span-2',
              title: 'Lightning Fast HMR',
            },
            {
              description:
                'World-class caching system that ensures you never run the same task twice.',
              icon: 'i-ph-cube-fill',
              title: 'Task Caching',
            },
            {
              description: 'Strict dependency management and reproducible builds out of the box.',
              icon: 'i-ph-shield-check-fill',
              title: 'Zero-Volatility',
            },
            {
              description: 'Integrated Oxlint and deep type-aware analysis. Catch every edge case.',
              icon: 'i-ph-seal-check-fill',
              span: 'md:col-span-2',
              title: 'Type-Safe Excellence',
            },
            {
              description:
                'Designed for the largest teams and most complex codebases in the world.',
              icon: 'i-ph-globe-simple-fill',
              title: 'Global Scale',
            },
            {
              description: 'One binary (vp) to rule them all. No more context switching.',
              icon: 'i-ph-command-fill',
              title: 'Unified CLI',
            },
          ]}
        />

        <CTA
          title='Ready to build the future?'
          subtitle='Join thousands of elite engineers building the next generation of the web with Light Project.'
          primaryAction={{ text: 'Get Started Now' }}
          secondaryAction={{ text: 'View on GitHub' }}
        />
      </main>

      <Footer />
    </div>
  );
};

export default App;
