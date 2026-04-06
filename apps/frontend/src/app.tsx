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
          secondaryAction={{ text: 'View Documentation' }}
        />

        <div className='relative'>
          <div className='absolute inset-0 bg-gradient-to-b from-surface-dark via-primary-500/5 to-surface-dark pointer-events-none' />
          <Marquee direction='left' speed={35}>
            <MarqueeItem icon='i-logos-vitejs' text='Vite' />
            <MarqueeItem icon='i-ph-cube-duotone' text='Rolldown' />
            <MarqueeItem icon='i-logos-vitest' text='Vitest' />
            <MarqueeItem icon='i-ph-seal-check-duotone' text='Oxlint' />
            <MarqueeItem icon='i-ph-brackets-curly-duotone' text='tsdown' />
            <MarqueeItem icon='i-ph-terminal-window-duotone' text='Vite Task' />
            <MarqueeItem icon='i-logos-typescript-icon' text='TypeScript' />
          </Marquee>
        </div>

        <section className='section-container relative'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-24 items-center'>
            <div className='animate-reveal'>
              <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 text-primary-400 text-xs font-bold uppercase tracking-widest mb-6 border border-primary-500/20'>
                <span className='w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse' />
                Performance First
              </div>
              <h2 className='text-5xl md:text-7xl font-black text-white mb-8 font-header leading-[0.95] tracking-tight'>
                Engineered for <br />
                <span className='text-gradient-primary'>Developer Velocity</span>
              </h2>
              <p className='text-xl text-slate-400 mb-12 leading-relaxed max-w-xl'>
                Vite+ wraps the world's fastest tools into a single, cohesive CLI. Experience
                instant feedback loops and zero-config monorepo management.
              </p>
              <ul className='space-y-6'>
                {[
                  { desc: 'No more waiting for rebuilds.', text: 'Instant HMR under 50ms' },
                  { desc: 'Never run the same task twice.', text: 'Universal Task Caching' },
                  { desc: 'Find bugs before they happen.', text: 'Type-Aware Linting' },
                ].map((item, idx) => (
                  <li key={idx} className='group'>
                    <div className='flex items-start gap-5'>
                      <div className='mt-1 w-6 h-6 rounded-lg bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/20 transition-colors border border-white/5'>
                        <span className='i-ph-check-bold text-xs text-primary-400'></span>
                      </div>
                      <div>
                        <div className='text-slate-200 font-bold text-lg mb-1'>{item.text}</div>
                        <div className='text-slate-400 text-sm'>{item.desc}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className='animate-reveal' style={{ animationDelay: '0.2s' }}>
              <div className='relative'>
                <div className='absolute -inset-4 bg-primary-500/20 blur-3xl rounded-full opacity-50' />
                <Terminal
                  commands={[
                    {
                      command: 'vp check',
                      output: [
                        '✔ Format (oxfmt) done',
                        '✔ Lint (oxlint) done',
                        '✔ Type check done',
                      ],
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
                      output: [
                        '➜ Vite+ Dev Server',
                        '➜ Local: http://localhost:3000',
                        '➜ HMR Ready',
                      ],
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        <Features
          title='The Complete Toolchain'
          subtitle='Every tool you need, unified into a single binary. No more complex configurations.'
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
          primaryAction={{ text: 'Start Building' }}
          secondaryAction={{ text: 'View on GitHub' }}
        />
      </main>

      <Footer />
    </div>
  );
};

export default App;
