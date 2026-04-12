import { type HTMLAttributes, forwardRef, useState } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { lightnessStops, themes } from '../utils/theme-generator';
import { Badge } from './badge';
import type { BaseComponentProps } from '../types/component';
import { Button } from './button';
import { Card } from './card';
import { Section } from './layout';
import { Typography } from './typography';
import { previewStyles } from '../tokens/styles';

// ─── Constants ───────────────────────────────────────────────────────────────

type Mode = 'light' | 'dark';
type ColorKey = 'primary' | 'accent' | 'surface' | 'success' | 'warning' | 'danger' | 'info';

const PALETTES: ColorKey[] = [
  'primary',
  'accent',
  'surface',
  'success',
  'warning',
  'danger',
  'info',
];

const STOPS = Object.keys(lightnessStops).toSorted(
  (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
);

// ─── CVA ────────────────────────────────────────────────────────────────────

const previewVariants = cva(previewStyles.base, {
  defaultVariants: previewStyles.default,
  variants: previewStyles.variants,
});

type PreviewVariants = VariantProps<typeof previewVariants>;

// ─── Sub-Components ─────────────────────────────────────────────────────────

/**
 * A single color chip with its label.
 */
const ColorSwatch = ({ palette, stop }: { palette: string; stop: string }) => {
  const isBase = stop === 'base';
  const varName = `--${palette}-${stop}`;

  return (
    <div className={previewStyles.slots.colorSwatch}>
      <div
        className={previewStyles.slots.colorSwatchChip}
        style={{ backgroundColor: `rgb(var(${varName}))` }}
      />
      <Typography type='caption' className={previewStyles.slots.colorSwatchLabel}>
        {isBase ? 'Base' : stop}
      </Typography>
    </div>
  );
};

/**
 * A full row of color stops for one palette.
 */
const ScaleRow = ({ palette }: { palette: ColorKey }) => (
  <div className={previewStyles.slots.scaleRow}>
    <Typography type='caption' className={previewStyles.slots.scaleRowLabel}>
      {palette}
    </Typography>
    <div className={previewStyles.slots.scaleRowGrid}>
      {STOPS.map((stop) => (
        <ColorSwatch key={stop} palette={palette} stop={stop} />
      ))}
      <div className={previewStyles.slots.scaleDivider} />
      <ColorSwatch palette={palette} stop='base' />
    </div>
  </div>
);

/**
 * Showcase for semantic/adaptive tokens.
 */
const SemanticShowcase = () => (
  <div className={previewStyles.slots.semanticGrid}>
    <Card useDefault intent='premium' className={previewStyles.slots.showcaseCard}>
      <Typography type='caption' className={previewStyles.slots.showcaseCardTitle}>
        Adaptive Interaction
      </Typography>
      <div className={previewStyles.slots.adaptiveDemoStack}>
        <div className={previewStyles.slots.adaptiveDemo}>Background Inverse / Text Adaptive</div>
        <div className={previewStyles.slots.primaryDemo}>Primary Border & Text</div>
        <div className={previewStyles.slots.buttonRow}>
          <Button useDefault intent='primary' size='sm'>
            Action
          </Button>
          <Button useDefault intent='ghost' size='sm'>
            Ghost
          </Button>
        </div>
      </div>
    </Card>

    <Card useDefault intent='glass' className={previewStyles.slots.showcaseCard}>
      <Typography type='caption' className={previewStyles.slots.showcaseCardTitle}>
        Neutral Surfaces
      </Typography>
      <div className={previewStyles.slots.surfaceGrid}>
        {[50, 100, 200, 300].map((s) => (
          <div
            key={s}
            className={previewStyles.slots.surfaceItem}
            style={{ backgroundColor: `rgb(var(--surface-${s}))` }}
          >
            surface-{s}
          </div>
        ))}
      </div>
    </Card>
  </div>
);

/**
 * A themed showcase for a single theme + mode combination.
 */
const ThemePreview = ({ theme, mode }: { theme: string; mode: Mode }) => {
  const isDefault = theme === 'default';
  const wrapperClass = `${isDefault ? '' : theme} ${mode} ${previewStyles.slots.themeWrapper}`;

  return (
    <div className={wrapperClass}>
      <Card useDefault intent='premium' className={previewStyles.slots.themeCard}>
        <div className={previewStyles.slots.themeGlowTop} />
        <div className={previewStyles.slots.themeGlowBottom} />

        <div className={previewStyles.slots.themeHeader}>
          <div>
            <Typography type='headline' className={previewStyles.slots.themeTitle}>
              {theme}
            </Typography>
            <Typography type='body' className={previewStyles.slots.themeModeText}>
              Configuration:{' '}
              <span className={previewStyles.slots.themeModeAccent}>{mode} mode</span>
            </Typography>
          </div>
          <Badge useDefault intent='primary' size='md'>
            Active Theme
          </Badge>
        </div>

        <div className={previewStyles.slots.themeMain}>
          {PALETTES.map((palette) => (
            <ScaleRow key={palette} palette={palette} />
          ))}
        </div>

        <SemanticShowcase />
      </Card>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

interface PreviewProps extends BaseComponentProps<HTMLAttributes<HTMLElement>>, PreviewVariants {}

const Preview = forwardRef<HTMLElement, PreviewProps>(
  ({ children, className = '', props, useDefault = false }, ref) => {
    const themeList = Object.keys(themes);
    const [activeTheme, setActiveTheme] = useState(themeList[0]);
    const [activeMode, setActiveMode] = useState<Mode>('light');

    const finalClass = useDefault ? previewVariants({ className }) : className;

    return (
      <Section {...props} ref={ref} className={finalClass}>
        {useDefault && (
          <>
            <header className={previewStyles.slots.header}>
              <div className={previewStyles.slots.headerTitleGroup}>
                <Typography as='h1' type='headline' className={previewStyles.slots.title}>
                  Design <span className={previewStyles.slots.themeModeAccent}>System</span>
                </Typography>
                <Typography type='body' className={previewStyles.slots.subtitle}>
                  Interactive explorer for OKLCH foundations.
                </Typography>
              </div>

              <div className={previewStyles.slots.controlBar}>
                <div className={previewStyles.slots.controlGroup}>
                  {themeList.map((t) => (
                    <Button
                      useDefault
                      key={t}
                      intent={activeTheme === t ? 'premium' : 'ghost'}
                      size='sm'
                      props={{
                        onClick: () => {
                          setActiveTheme(t);
                        },
                      }}
                      className={previewStyles.slots.themeSelectorButton}
                    >
                      {t}
                    </Button>
                  ))}
                </div>

                <div className={previewStyles.slots.controlGroup}>
                  {(['light', 'dark'] as const).map((m) => (
                    <Button
                      useDefault
                      key={m}
                      intent={activeMode === m ? 'premium' : 'ghost'}
                      size='sm'
                      props={{
                        onClick: () => {
                          setActiveMode(m);
                        },
                      }}
                      className={previewStyles.slots.modeButton}
                    >
                      <span
                        className={
                          m === 'light' ? previewStyles.slots.iconSun : previewStyles.slots.iconMoon
                        }
                      />
                      <Typography type='caption'>{m}</Typography>
                    </Button>
                  ))}
                </div>
              </div>
            </header>

            <main className={previewStyles.slots.main}>
              <ThemePreview theme={activeTheme} mode={activeMode} />
            </main>

            <footer className={previewStyles.slots.footer}>
              <span>Vite+ & OKLCH Unified Toolchain</span>
              <span>&copy; 2026 LIGHT PROJECT</span>
            </footer>
          </>
        )}

        {children}
      </Section>
    );
  },
);

Preview.displayName = 'Preview';

export type { PreviewProps, PreviewVariants };
export { Preview, previewVariants };
