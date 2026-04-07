import { Header, getWeights } from '@lightproject/design-system';
import { type ReactNode, useEffect } from 'react';
import { logger } from '@lightproject/common';

const Section = ({
  title,
  children,
  description,
}: {
  title: string;
  children: ReactNode;
  description?: string;
}) => (
  <section className='section-container py-12 border-b'>
    <div className='mb-8'>
      <h2 className='text-3xl font-header font-bold mb-4'>{title}</h2>
      {description !== undefined && description !== '' && (
        <p className='text-muted max-w-2xl'>{description}</p>
      )}
    </div>
    {children}
  </section>
);

const ColorSquare = ({ variable, label }: { variable: string; label: string }) => {
  const step = Number.parseInt(label, 10);
  const isDark = step >= 500;

  return (
    <div className='flex flex-col gap-2'>
      <div
        className={`h-20 w-full rounded-xl border border-solid border-white/20 dark:border-black/20 transition-transform hover:scale-105 duration-300`}
        style={{ backgroundColor: `rgb(var(${variable}))` }}
      >
        <div
          className={`flex items-center justify-center h-full font-bold font-mono text-sm tracking-tight ${
            isDark ? 'text-white' : 'text-black'
          }`}
        >
          {label}
        </div>
      </div>
      <div className='text-[10px] font-mono text-muted-inverse uppercase truncate opacity-80'>
        {variable}
      </div>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    logger.info('Design System Showcase - Debug Mode', {
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <div className='min-h-screen bg-adaptive text-adaptive font-sans'>
      <Header />

      <main className='max-w-7xl mx-auto px-6 pt-20'>
        <Section title='Color Palette'>
          <div className='flex flex-col gap-8'>
            {['primary', 'accent', 'surface'].map((key) => (
              <div key={key}>
                <div className='text-xs font-bold uppercase mb-4 tracking-widest opacity-50'>
                  {key}
                </div>
                <div className='grid grid-cols-2 md:grid-cols-6 lg:grid-cols-11 gap-4 bg-inverse p-8 rounded-[2rem] border border-white/10 dark:border-black/10 shadow-2xl'>
                  {Object.keys(getWeights()).map((step) => (
                    <ColorSquare
                      key={`${key}-${step}`}
                      variable={`--${key}-${step}`}
                      label={step}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
};

export default App;
