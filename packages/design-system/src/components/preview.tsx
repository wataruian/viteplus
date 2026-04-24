import { Container, Section } from './layout';
import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { ErrorBoundary } from './error-boundary';
import { ModeProvider } from '../context/mode-context';
import { ModeSwitcher } from './mode-switcher';
import { ThemeProvider } from '../context/theme-context';
import { ThemeSwitcher } from './theme-switcher';
import { Typography } from './typography';
import { previewStyles } from '../tokens/styles';

const previewVariants = cva(previewStyles.base, {
  defaultVariants: previewStyles.default,
  variants: previewStyles.variants,
});

type PreviewVariants = VariantProps<typeof previewVariants>;

interface PreviewProps extends BaseComponentProps<HTMLAttributes<HTMLElement>>, PreviewVariants {}

const scales: number[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const ScaleRow = forwardRef<HTMLDivElement, { name: string; title: string }>(
  ({ name, title }, ref) => (
    <div ref={ref} className={previewStyles.slots.section}>
      <div className={previewStyles.slots['section-header']}>
        <Typography as='h2' type='sub-headline'>
          {title}
        </Typography>
      </div>
      <div className='flex flex-wrap gap-3 items-start'>
        {scales.map((s) => (
          <div key={s} className='flex flex-col gap-2'>
            <div
              className='w-12 h-12 md:w-16 md:h-16 rounded-xl border border-adaptive-border shadow-sm ring-2 ring-primary/20 hover:scale-110 hover:shadow-lg transition-transform duration-300 cursor-pointer'
              style={{ backgroundColor: `rgb(var(--ds-${name}-${s}))` }}
            />
            <span className='text-[10px] md:text-xs font-mono text-adaptive-text-muted text-center'>
              {s}
            </span>
          </div>
        ))}

        <div className='w-[1px] h-12 md:h-16 bg-adaptive-inverse mx-1 self-start opacity-15' />

        <div className='flex flex-col gap-2'>
          <div
            className='w-12 h-12 md:w-16 md:h-16 rounded-xl border border-adaptive-border shadow-sm ring-2 ring-primary/20 hover:scale-110 hover:shadow-lg transition-transform duration-300 cursor-pointer'
            style={{ backgroundColor: `rgb(var(--ds-${name}-base))` }}
          />
          <span className='text-[10px] md:text-xs font-black text-primary text-center'>Base</span>
        </div>
      </div>
    </div>
  ),
);

ScaleRow.displayName = 'ScaleRow';

const Preview = forwardRef<HTMLElement, PreviewProps>(
  ({ className = '', props, useDefault = true }, ref) => {
    const finalClass = useDefault ? previewVariants({ className }) : className;

    return (
      <ThemeProvider>
        <ModeProvider>
          <ErrorBoundary>
            <Section {...props} ref={ref} className={finalClass}>
              <Container>
                <div className={previewStyles.slots.content}>
                  <div className={previewStyles.slots.header}>
                    <div className={previewStyles.slots['header-info']}>
                      <Typography as='h1' type='display'>
                        Design System
                      </Typography>
                      <Typography type='body' className={previewStyles.slots.description}>
                        A collection of curated components, tokens, and utilities for building
                        high-performance web applications. This system is designed to be expressive,
                        accessible, and easily customizable.
                      </Typography>
                    </div>

                    <div className={previewStyles.slots.actions}>
                      <div className={previewStyles.slots.controls}>
                        <ThemeSwitcher plain />
                        <div className={previewStyles.slots.divider} />
                        <ModeSwitcher />
                      </div>
                    </div>
                  </div>

                  <div className='space-y-12 md:space-y-20'>
                    <div className='space-y-8'>
                      <Typography
                        as='h2'
                        type='sub-headline'
                        className='uppercase tracking-widest opacity-70'
                      >
                        Experience Themes
                      </Typography>
                      <div className='grid gap-12'>
                        <ScaleRow name='primary' title='Primary Scale' />
                        <ScaleRow name='accent' title='Accent Scale' />
                        <ScaleRow name='surface' title='Surface Scale' />
                        <ScaleRow name='danger' title='Danger Scale' />
                      </div>
                    </div>
                  </div>
                </div>
              </Container>
            </Section>
          </ErrorBoundary>
        </ModeProvider>
      </ThemeProvider>
    );
  },
);

Preview.displayName = 'Preview';

export type { PreviewVariants, PreviewProps };
export { Preview };
