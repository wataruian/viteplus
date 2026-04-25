import * as styles from '../tokens/styles';
import * as ui from './index';
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

const previewVariants = cva(styles.previewStyles.base, {
  defaultVariants: styles.previewStyles.default,
  variants: styles.previewStyles.variants,
});

type PreviewVariants = VariantProps<typeof previewVariants>;

interface PreviewProps extends BaseComponentProps<HTMLAttributes<HTMLElement>>, PreviewVariants {}

const scales: number[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const ScaleRow = forwardRef<HTMLDivElement, { name: string; title: string }>(
  ({ name, title }, ref) => (
    <div ref={ref} className={styles.previewStyles.slots.section}>
      <div className={styles.previewStyles.slots.sectionHeader}>
        <Typography as='h2' type='display'>
          {title}
        </Typography>
      </div>
      <div className={styles.previewStyles.slots.swatchesContainer}>
        {scales.map((s) => (
          <div key={s} className={styles.previewStyles.slots.swatchItem}>
            <div
              className={styles.previewStyles.slots.swatchColor}
              style={{ backgroundColor: `rgb(var(--${classPrefix}-${name}-${s}))` }}
            />
            <span className={styles.previewStyles.slots.swatchLabel}>{s}</span>
          </div>
        ))}

        <div className={styles.previewStyles.slots.swatchDivider} />

        <div className={styles.previewStyles.slots.swatchItem}>
          <div
            className={styles.previewStyles.slots.swatchColor}
            style={{ backgroundColor: `rgb(var(--${classPrefix}-${name}-base))` }}
          />
          <span className={styles.previewStyles.slots.swatchLabel}>Base</span>
        </div>
      </div>
    </div>
  ),
);

ScaleRow.displayName = 'ScaleRow';

const PREVIEW_ICON = ['i', 'ph', 'star', 'duotone'].join('-');

const getExtraProps = (componentName: string, variant?: string, group?: string) => {
  switch (componentName) {
    case 'Icon': {
      return { className: 'text-primary', name: PREVIEW_ICON };
    }
    case 'Input': {
      return {
        props: {
          placeholder: variant === undefined ? 'Default placeholder' : `${variant} ${group}`,
        },
      };
    }
    case 'Logo': {
      return { textBottom: 'PROJECT', textTop: 'LIGHT' };
    }
    case 'Marquee': {
      return { children: <ui.Badge>Item</ui.Badge> };
    }
    default: {
      return {};
    }
  }
};

const renderChildren = (componentName: string, variant: string): React.ReactNode => {
  if (componentName === 'Typography') {
    return `${variant} Typography`;
  }
  if (['Icon', 'Input', 'Logo', 'Marquee'].includes(componentName)) {
    return null;
  }
  return variant;
};

const isWideComponent = (componentName: string) =>
  ['Typography', 'Marquee', 'Header'].includes(componentName);

const isRecord = (val: unknown): val is Record<string, unknown> =>
  typeof val === 'object' && val !== null;

const Preview = forwardRef<HTMLElement, PreviewProps>(
  ({ className = '', props, useDefault = true }, ref) => {
    const finalClass = useDefault ? previewVariants({ className }) : className;

    const displayableComponents = Object.keys(styles)
      .filter((key): key is keyof typeof styles => key.endsWith('Styles'))
      .filter((key) => !['previewStyles', 'layoutStyles', 'errorBoundaryStyles'].includes(key))
      .map((styleKey) => {
        const baseName = styleKey.replace('Styles', '');
        const capitalized = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        const Component = (ui as Record<string, React.ElementType>)[capitalized];
        const styleObj = styles[styleKey] as Record<string, unknown>;
        return { Component, name: capitalized, styleKey, styleObj };
      })
      .filter((item): item is typeof item & { Component: React.ElementType } =>
        Boolean(item.Component),
      )
      .toSorted((a, b) => a.name.localeCompare(b.name));

    return (
      <ThemeProvider>
        <ModeProvider>
          <ErrorBoundary>
            <Section {...props} ref={ref} className={finalClass}>
              <Container>
                <div className={styles.previewStyles.slots.content}>
                  <div className={styles.previewStyles.slots.header}>
                    <div className={styles.previewStyles.slots.headerInfo}>
                      <Typography as='h1' type='display'>
                        Design System
                      </Typography>
                      <Typography type='body' className={styles.previewStyles.slots.description}>
                        A collection of curated components, tokens, and utilities for building
                        high-performance web applications. This system is designed to be expressive,
                        accessible, and easily customizable.
                      </Typography>
                    </div>

                    <div className={styles.previewStyles.slots.actions}>
                      <div className={styles.previewStyles.slots.controls}>
                        <ThemeSwitcher plain />
                        <div className={styles.previewStyles.slots.divider} />
                        <ModeSwitcher />
                      </div>
                    </div>
                  </div>

                  <div className={styles.previewStyles.slots.themesContainer}>
                    <div className={styles.previewStyles.slots.themesSection}>
                      <Typography
                        as='h2'
                        type='display'
                        className={styles.previewStyles.slots.themesTitle}
                      >
                        Theme Color Scales
                      </Typography>
                      <div className={styles.previewStyles.slots.themesGrid}>
                        <ScaleRow name='primary' title='Primary Scale' />
                        <ScaleRow name='accent' title='Accent Scale' />
                        <ScaleRow name='surface' title='Surface Scale' />
                        <ScaleRow name='success' title='Success Scale' />
                        <ScaleRow name='warning' title='Warning Scale' />
                        <ScaleRow name='danger' title='Danger Scale' />
                        <ScaleRow name='info' title='Info Scale' />
                      </div>
                    </div>

                    <div className={styles.previewStyles.slots.themesSection}>
                      <Typography
                        as='h2'
                        type='display'
                        className={styles.previewStyles.slots.themesTitle}
                      >
                        Components
                      </Typography>
                      <div className={styles.previewStyles.slots.componentsGrid}>
                        {displayableComponents.map(({ Component, styleObj, name }) => {
                          const { variants } = styleObj;

                          return (
                            <div
                              key={name}
                              className={`flex flex-col gap-4 ${isWideComponent(name) ? 'lg:col-span-2' : ''}`}
                            >
                              <Typography as='h2' type='display'>
                                {name}
                              </Typography>
                              <ui.Card
                                intent='outline'
                                className={styles.previewStyles.slots.componentCard}
                              >
                                <div className='flex flex-col gap-8 w-full'>
                                  {/* Default Variant */}
                                  <div className='flex flex-col gap-2'>
                                    <Typography
                                      as='span'
                                      type='caption'
                                      className='font-bold uppercase tracking-widest opacity-40'
                                    >
                                      Default
                                    </Typography>
                                    <div className='flex flex-wrap gap-4 items-center'>
                                      <Component {...getExtraProps(name)}>
                                        {renderChildren(name, 'Default')}
                                      </Component>
                                    </div>
                                  </div>

                                  {/* Variant Groups */}
                                  {isRecord(variants) &&
                                    Object.keys(variants)
                                      .filter((g): g is string => Object.hasOwn(variants, g))
                                      .map((group) => {
                                        const groupVariants = variants[group];

                                        return (
                                          <div key={group} className='flex flex-col gap-2'>
                                            <Typography
                                              as='span'
                                              type='caption'
                                              className='font-bold uppercase tracking-widest opacity-40'
                                            >
                                              {group}
                                            </Typography>
                                            <div className='flex flex-wrap gap-4 items-center'>
                                              {isRecord(groupVariants) &&
                                                Object.keys(groupVariants)
                                                  .filter((v): v is string =>
                                                    Object.hasOwn(groupVariants, v),
                                                  )
                                                  .map((variant) => (
                                                    <div
                                                      key={variant}
                                                      className='flex flex-col items-center gap-1'
                                                    >
                                                      <Component
                                                        {...{ [group]: variant }}
                                                        {...getExtraProps(name, variant, group)}
                                                        className={
                                                          name === 'Card'
                                                            ? 'p-6 text-center text-sm font-bold flex items-center justify-center min-w-[120px]'
                                                            : undefined
                                                        }
                                                      >
                                                        {renderChildren(name, variant)}
                                                      </Component>
                                                      {name === 'Icon' && (
                                                        <Typography
                                                          type='caption'
                                                          className='opacity-40'
                                                        >
                                                          {variant}
                                                        </Typography>
                                                      )}
                                                    </div>
                                                  ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                </div>
                              </ui.Card>
                            </div>
                          );
                        })}
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
