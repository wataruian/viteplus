import { Container, Section } from './layout';
import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { ErrorBoundary } from './error-boundary';
import { ModeProvider } from '../context/mode-provider';
import { ModeSwitcher } from './mode-switcher';
import { ThemeProvider } from '../context/theme-provider';
import { ThemeSwitcher } from './theme-switcher';
import { Typography } from './typography';
import { classPrefix } from '../utils';
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
      <div className={previewStyles.slots.sectionHeader}>
        <Typography as='h2' type='display'>
          {title}
        </Typography>
      </div>
      <div className={previewStyles.slots.swatchesContainer}>
        {scales.map((s) => (
          <div key={s} className={previewStyles.slots.swatchItem}>
            <div
              className={previewStyles.slots.swatchColor}
              style={{ backgroundColor: `rgb(var(--${classPrefix}-${name}-${s}))` }}
            />
            <span className={previewStyles.slots.swatchLabel}>{s}</span>
          </div>
        ))}

        <div className={previewStyles.slots.swatchDivider} />

        <div className={previewStyles.slots.swatchItem}>
          <div
            className={previewStyles.slots.swatchColor}
            style={{ backgroundColor: `rgb(var(--${classPrefix}-${name}-base))` }}
          />
          <span className={previewStyles.slots.swatchLabelBase}>Base</span>
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
                    <div className={previewStyles.slots.headerInfo}>
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

                  <div className={previewStyles.slots.themesContainer}>
                    <div className={previewStyles.slots.themesSection}>
                      <Typography
                        as='h2'
                        type='display'
                        className={previewStyles.slots.themesTitle}
                      >
                        Experience Themes
                      </Typography>
                      <div className={previewStyles.slots.themesGrid}>
                        <ScaleRow name='primary' title='Primary Scale' />
                        <ScaleRow name='accent' title='Accent Scale' />
                        <ScaleRow name='surface' title='Surface Scale' />
                        <ScaleRow name='success' title='Success Scale' />
                        <ScaleRow name='warning' title='Warning Scale' />
                        <ScaleRow name='danger' title='Danger Scale' />
                        <ScaleRow name='info' title='Info Scale' />
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
