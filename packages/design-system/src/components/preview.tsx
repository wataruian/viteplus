import { type VariantProps, cva } from 'class-variance-authority';
import { type HTMLAttributes, forwardRef } from 'react';

import { ModeProvider } from '../context/mode-provider';
import { ThemeProvider } from '../context/theme-provider';
import { baseStyles } from '../tokens/base';
import { classPrefix } from '../utils/helpers';
import type { BaseComponentProps } from './base';
import { ErrorBoundary } from './error-boundary';
import { Container, Section } from './layout';
import { ModeSwitcher } from './mode-switcher';
import * as registry from './registry';
import { ThemeSwitcher } from './theme-switcher';
import { Typography } from './typography';

const previewStyles = {
  base: 'pt-2 md:pt-4',
  default: {},
  slots: {
    actions: 'flex shrink-0 items-center gap-4 self-start',
    cardPreview: 'p-6 text-center text-sm font-bold flex items-center justify-center min-w-[120px]',
    componentCard: `rounded-2xl overflow-hidden transition-all duration-300 ${baseStyles.colors.bg.transparent} border-2 ${baseStyles.colors.ring.inverseSurface}/10 shadow-sm hover:${baseStyles.colors.border.primary}/30 flex flex-col items-center justify-center gap-1 p-2`,
    componentCardInner: 'flex flex-col gap-1 w-full',
    componentGrid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
    componentTitle: 'break-words min-w-0',
    componentWrapper: 'flex flex-col gap-2 min-w-0',
    content: 'flex flex-col gap-4 md:gap-6',
    controls: 'flex flex-wrap items-center gap-2 p-1.5 w-fit',
    description: 'max-w-2xl opacity-90',
    divider: `w-[1px] h-11 ${baseStyles.colors.bg.inverseSurface} mx-1 hidden sm:block`,
    groupLabel: 'font-bold uppercase tracking-widest opacity-40',
    groupWrapper: `flex flex-col gap-1 ${baseStyles.colors.bg.inversePrimary}/10 p-2 rounded-2xl shadow-sm`,
    header: 'flex flex-col md:flex-row md:items-start justify-between gap-8',
    headerInfo: 'flex-1 space-y-4 md:space-y-6 pt-2 md:pt-4',
    iconLabel: 'opacity-40',
    iconPreview: baseStyles.colors.text.primary,
    section: 'space-y-4',
    sectionHeader: 'flex items-center gap-3',
    showcaseIcon: 'i-ph-star-fill',
    swatchColor: `w-12 h-12 md:w-16 md:h-16 rounded-xl shadow-sm ring-2 ${baseStyles.colors.ring.inverseSurface} hover:scale-110 hover:shadow-lg transition-transform duration-300 cursor-pointer`,
    swatchDivider: `w-[1px] h-12 md:h-16 ${baseStyles.colors.bg.inversePrimary} mx-1 self-start`,
    swatchItem: 'flex flex-col gap-2',
    swatchLabel: `text-[10px] md:text-xs font-mono ${baseStyles.colors.text.inverseSurface}/60 text-center`,
    swatchesContainer: 'flex flex-wrap gap-3 items-start',
    themesContainer: 'space-y-8 md:space-y-12',
    themesGrid: 'grid gap-12',
    themesSection: 'space-y-8',
    themesTitle: 'uppercase tracking-widest opacity-70',
  },
  variants: {
    cardAlignment: {
      block: '!items-stretch',
      inline: '',
    },
    variantItem: {
      block: 'flex flex-col items-stretch w-full gap-1 min-w-0',
      inline: 'flex flex-col items-center gap-1 min-w-0',
    },
    variantList: {
      block: 'flex flex-col items-stretch w-full gap-2 min-w-0',
      inline: 'flex flex-wrap items-end gap-2 min-w-0',
    },
    wrapperWidth: {
      standard: '',
      wide: 'lg:col-span-2',
    },
  },
} as const;

const previewVariants = cva(previewStyles.base, {
  defaultVariants: previewStyles.default,
  variants: previewStyles.variants,
});

type PreviewVariants = VariantProps<typeof previewVariants>;

interface PreviewProps extends BaseComponentProps<HTMLAttributes<HTMLElement>>, PreviewVariants {
  showDefault?: boolean;
}

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
          <span className={previewStyles.slots.swatchLabel}>Base</span>
        </div>
      </div>
    </div>
  ),
);

ScaleRow.displayName = 'ScaleRow';

const MockError = () => {
  throw new Error('This is a preview error to demonstrate the ErrorBoundary UI');
};

const getExtraProps = (componentName: string, variant?: string, group?: string) => {
  switch (componentName) {
    case 'ErrorBoundary': {
      const effectiveIntent = variant ?? registry.errorBoundaryStyles.default.intent;
      const displayTitle = `${effectiveIntent.charAt(0).toUpperCase() + effectiveIntent.slice(1)} Error`;
      return { children: <MockError />, title: displayTitle };
    }
    case 'Icon': {
      return {
        className: previewStyles.slots.iconPreview,
        name: previewStyles.slots.showcaseIcon,
      };
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

const isForwardRefComponent = (val: unknown): val is React.ComponentType<Record<string, unknown>> =>
  typeof val === 'object' &&
  val !== null &&
  '$$typeof' in val &&
  (val as Record<string, unknown>)['$$typeof'] === Symbol.for('react.forward_ref');

const Preview = forwardRef<HTMLElement, PreviewProps>(
  ({ className = '', props, useDefault = true, showDefault = false }, ref) => {
    const finalClass = useDefault ? previewVariants({ className }) : className;

    const styles = Object.fromEntries(
      Object.entries(registry).filter(([key]) => key.endsWith('Styles')),
    );

    const ui: Record<string, React.ComponentType<Record<string, unknown>>> = {};

    for (const [key, value] of Object.entries(registry)) {
      if (!key.endsWith('Styles') && isForwardRefComponent(value)) {
        ui[key] = value;
      }
    }

    const displayableComponents = Object.keys(styles)
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
      .flatMap((styleKey) => {
        const baseName = styleKey.replace('Styles', '');
        const capitalized = baseName.charAt(0).toUpperCase() + baseName.slice(1);

        const maybeComponent = ui[capitalized];
        if (!isForwardRefComponent(maybeComponent)) {
          return [];
        }

        const styleObj = styles[styleKey];

        return [
          {
            Component: maybeComponent,
            name: capitalized,
            styleKey,
            styleObj,
          },
        ];
      })
      .toSorted((a, b) => a.name.localeCompare(b.name));

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
                        Theme Color Scales
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

                    <div className={previewStyles.slots.themesSection}>
                      <Typography
                        as='h2'
                        type='display'
                        className={previewStyles.slots.themesTitle}
                      >
                        Components
                      </Typography>
                      <div className={previewStyles.slots.componentGrid}>
                        {displayableComponents.map(({ Component, styleObj, name }) => {
                          const variants = isRecord(styleObj) ? styleObj.variants : undefined;
                          const layoutType = isBlockComponent(name) ? 'block' : 'inline';
                          const widthType = isWideComponent(name) ? 'wide' : 'standard';

                          return (
                            <div
                              key={name}
                              className={`${previewStyles.slots.componentWrapper} ${previewVariants({ wrapperWidth: widthType })}`}
                            >
                              <Typography
                                as='h2'
                                type='display'
                                className={previewStyles.slots.componentTitle}
                              >
                                {name}
                              </Typography>
                              <registry.Card
                                intent='outline'
                                className={`${previewStyles.slots.componentCard} ${previewVariants({ cardAlignment: layoutType })}`}
                              >
                                <div className={previewStyles.slots.componentCardInner}>
                                  {showDefault ? (
                                    <div className={previewStyles.slots.groupWrapper}>
                                      <Typography
                                        as='span'
                                        type='caption'
                                        className={previewStyles.slots.groupLabel}
                                      >
                                        {(() => {
                                          const defObj = isRecord(styleObj)
                                            ? styleObj.default
                                            : null;
                                          const defs = isRecord(defObj)
                                            ? Object.entries(defObj)
                                                .map(([k, v]) => `${k}: ${v}`)
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
                                    Object.keys(variants).map((group) => {
                                      const groupVariants = (variants as Record<string, unknown>)[
                                        group
                                      ];

                                      return (
                                        <div
                                          key={group}
                                          className={previewStyles.slots.groupWrapper}
                                        >
                                          <Typography
                                            as='span'
                                            type='caption'
                                            className={previewStyles.slots.groupLabel}
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
                                                          ? previewStyles.slots.cardPreview
                                                          : undefined
                                                      }
                                                      {...getExtraProps(name, variant, group)}
                                                    >
                                                      {renderChildren(name, variant)}
                                                    </Component>
                                                    {name === 'Icon' && (
                                                      <Typography
                                                        type='caption'
                                                        className={previewStyles.slots.iconLabel}
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
                              </registry.Card>
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

export { Preview, previewStyles };
export type { PreviewProps, PreviewVariants };
