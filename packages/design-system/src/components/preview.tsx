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
import { showcaseIcon } from '../tokens/icons';

const previewVariants = cva(styles.previewStyles.base, {
  defaultVariants: styles.previewStyles.default,
  variants: styles.previewStyles.variants,
});

type PreviewVariants = VariantProps<typeof previewVariants>;

interface PreviewProps extends BaseComponentProps<HTMLAttributes<HTMLElement>>, PreviewVariants {
  showDefault?: boolean;
}

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

const MockError = () => {
  throw new Error('This is a preview error to demonstrate the ErrorBoundary UI.');
};

const getExtraProps = (componentName: string, variant?: string, group?: string) => {
  switch (componentName) {
    case 'ErrorBoundary': {
      const effectiveIntent = variant ?? styles.errorBoundaryStyles.default.intent;
      const displayTitle = `${effectiveIntent.charAt(0).toUpperCase() + effectiveIntent.slice(1)} Error`;
      return { children: <MockError />, title: displayTitle };
    }
    case 'Icon': {
      return { className: styles.previewStyles.slots.iconPreview, name: showcaseIcon };
    }
    case 'Input': {
      const displayState = variant ?? group ?? 'state';
      return {
        props: {
          placeholder:
            variant === undefined
              ? 'Default state'
              : `${displayState.charAt(0).toUpperCase() + displayState.slice(1)} state`,
        },
      };
    }
    case 'Logo': {
      return { textBottom: 'PROJECT', textTop: 'LIGHT' };
    }
    case 'Marquee': {
      return {
        className: 'bg-adaptive-surface/30 py-4 border-y border-inverse-surface/5',
      };
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
  if (componentName === 'ErrorBoundary') {
    return <MockError />;
  }
  if (componentName === 'Marquee') {
    return Array.from({ length: 6 }).map((_, i) => (
      <Typography key={i} type='subHeadline' className='mx-4 whitespace-nowrap'>
        Item {i + 1}
      </Typography>
    ));
  }
  if (['Icon', 'Input', 'Logo'].includes(componentName)) {
    return null;
  }
  return variant;
};

const isWideComponent = (componentName: string) =>
  ['Typography', 'Marquee', 'ErrorBoundary'].includes(componentName);

const isBlockComponent = (componentName: string) =>
  ['Input', 'Typography', 'Marquee', 'ErrorBoundary'].includes(componentName);

const isRecord = (val: unknown): val is Record<string, unknown> =>
  typeof val === 'object' && val !== null;

const Preview = forwardRef<HTMLElement, PreviewProps>(
  ({ className = '', props, useDefault = true, showDefault = false }, ref) => {
    const finalClass = useDefault ? previewVariants({ className }) : className;

    const displayableComponents = Object.keys(styles)
      .filter((key): key is keyof typeof styles => key.endsWith('Styles'))
      .filter(
        (key) =>
          ![
            'previewStyles',
            'layoutStyles',
            'headerStyles',
            'themeSwitcherStyles',
            'modeSwitcherStyles',
          ].includes(key),
      )
      .map((styleKey) => {
        const baseName = styleKey.replace('Styles', '');
        const capitalized = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        const Component = (ui as Record<string, React.ElementType>)[capitalized];
        const styleObj = (styles as Record<string, unknown>)[styleKey];

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
                      <div className={styles.previewStyles.slots.componentGrid}>
                        {displayableComponents.map(({ Component, styleObj, name }) => {
                          const variants = isRecord(styleObj) ? styleObj['variants'] : undefined;
                          const layoutType = isBlockComponent(name) ? 'block' : 'inline';
                          const widthType = isWideComponent(name) ? 'wide' : 'standard';

                          return (
                            <div
                              key={name}
                              className={`${styles.previewStyles.slots.componentWrapper} ${previewVariants({ wrapperWidth: widthType })}`}
                            >
                              <Typography
                                as='h2'
                                type='display'
                                className={styles.previewStyles.slots.componentTitle}
                              >
                                {name}
                              </Typography>
                              <ui.Card
                                intent='outline'
                                className={`${styles.previewStyles.slots.componentCard} ${previewVariants({ cardAlignment: layoutType })}`}
                              >
                                <div className={styles.previewStyles.slots.componentCardInner}>
                                  {showDefault ? (
                                    <div className={styles.previewStyles.slots.groupWrapper}>
                                      <Typography
                                        as='span'
                                        type='caption'
                                        className={styles.previewStyles.slots.groupLabel}
                                      >
                                        {(() => {
                                          const defObj = isRecord(styleObj)
                                            ? styleObj['default']
                                            : null;
                                          const defs = isRecord(defObj)
                                            ? Object.entries(defObj)
                                                .map(([k, v]) => `${k}: ${String(v)}`)
                                                .join(', ')
                                            : '';
                                          return `Default${defs ? ` (${defs})` : ''}`;
                                        })()}
                                      </Typography>
                                      <div className={previewVariants({ variantList: layoutType })}>
                                        <Component {...getExtraProps(name)}>
                                          {renderChildren(name, 'Default')}
                                        </Component>
                                      </div>
                                    </div>
                                  ) : null}

                                  {isRecord(variants) &&
                                    Object.keys(variants)
                                      .filter((g): g is string => Object.hasOwn(variants, g))
                                      .map((group) => {
                                        const groupVariants = variants[group];

                                        return (
                                          <div
                                            key={group}
                                            className={styles.previewStyles.slots.groupWrapper}
                                          >
                                            <Typography
                                              as='span'
                                              type='caption'
                                              className={styles.previewStyles.slots.groupLabel}
                                            >
                                              {group}
                                            </Typography>
                                            <div
                                              className={previewVariants({
                                                variantList: layoutType,
                                              })}
                                            >
                                              {isRecord(groupVariants) &&
                                                Object.keys(groupVariants)
                                                  .filter((v): v is string =>
                                                    Object.hasOwn(groupVariants, v),
                                                  )
                                                  .map((variant) => (
                                                    <div
                                                      key={variant}
                                                      className={previewVariants({
                                                        variantItem: layoutType,
                                                      })}
                                                    >
                                                      <Component
                                                        {...{ [group]: variant }}
                                                        className={
                                                          name === 'Card'
                                                            ? styles.previewStyles.slots.cardPreview
                                                            : undefined
                                                        }
                                                        {...getExtraProps(name, variant, group)}
                                                      >
                                                        {renderChildren(name, variant)}
                                                      </Component>
                                                      {name === 'Icon' && (
                                                        <Typography
                                                          type='caption'
                                                          className={
                                                            styles.previewStyles.slots.iconLabel
                                                          }
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
