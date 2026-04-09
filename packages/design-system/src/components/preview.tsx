import { Container, Section } from './layout';
import {
  badgeIntents,
  badgeSizes,
  buttonIntents,
  buttonSizes,
  cardIntents,
  previewContent,
  previewStyles,
  typographyStyles,
} from '../tokens/variants';

import { Badge } from './badge';
import type { BaseComponentProps } from '../types/component';
import { Button } from './button';
import { Card } from './card';
import type { HTMLAttributes } from 'react';
import { Marquee } from './marquee';
import { getSlotClass } from '../utils/styles';

type PreviewProps = BaseComponentProps<HTMLAttributes<HTMLDivElement>>;

const Preview = ({ className = '', props, useDefault = true }: PreviewProps) => {
  const finalClass = useDefault ? `${previewStyles.root} ${className}` : className;

  return (
    <div {...props} className={getSlotClass(useDefault, finalClass, props)}>
      {/* ─── Hero Section ─────────────────────────────────────────────────── */}
      <Section className={previewStyles.heroSection}>
        <Container>
          <div className={previewStyles.heroContent}>
            <Badge intent={previewStyles.heroBadgeIntent} size={previewStyles.heroBadgeSize}>
              {previewContent.heroBadge}
            </Badge>
            <h1 className={typographyStyles.display}>
              {previewContent.heroTitlePrefix}
              <span className={previewStyles.heroEmphasis}>{previewContent.heroTitleEmphasis}</span>
              {previewContent.heroTitleSuffix}
            </h1>
            <p className={previewStyles.heroBody}>{previewContent.heroDescription}</p>
            <div className={previewStyles.heroActions}>
              <Button
                intent={previewStyles.heroButtonPrimaryIntent}
                size={previewStyles.heroButtonPrimarySize}
              >
                {previewContent.heroCtaPrimary}
              </Button>
              <Button
                intent={previewStyles.heroButtonSecondaryIntent}
                size={previewStyles.heroButtonSecondarySize}
              >
                {previewContent.heroCtaSecondary}
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      {/* ─── Marquee Showcase ──────────────────────────────────────────────── */}
      <div className={previewStyles.marqueeWrapper}>
        <Marquee direction={previewStyles.marqueeDirection} speed={previewStyles.marqueeSpeed}>
          {Array.from({ length: previewStyles.showcaseCount }).map((_item, itemIndex) => (
            <div key={itemIndex} className={previewStyles.marqueeItem}>
              {previewContent.marqueeItems.map((text, textIndex) => (
                <span key={textIndex} className={typographyStyles.subheadline}>
                  {text}
                </span>
              ))}
            </div>
          ))}
        </Marquee>
      </div>

      {/* ─── Engineering Gallery Showcase ────────────────────────────────────── */}
      <Section className='bg-white/[0.01] border-y border-white/5'>
        <Container>
          <div className='space-y-32'>
            {/* Gallery Intro */}
            <div className='space-y-6 max-w-3xl'>
              <Badge intent='primary' size='lg'>
                System Overview
              </Badge>
              <h2 className={typographyStyles.headline}>Atomic Engineering Gallery</h2>
              <p className={typographyStyles.body}>
                Explore the complete set of atomic components and their variants. Our design system
                is built with strict type safety and token-first principles.
              </p>
            </div>

            {/* Buttons Section */}
            <div className='space-y-12'>
              <div className='border-b border-white/10 pb-4'>
                <h3 className={typographyStyles.subheadline}>Buttons</h3>
                <p className={typographyStyles.caption}>Intents & Scaling</p>
              </div>

              <div className='space-y-16'>
                {buttonIntents.map((intent) => (
                  <div key={intent} className='space-y-6'>
                    <p className='text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]'>
                      Intent: {intent}
                    </p>
                    <div className='flex flex-wrap items-end gap-6'>
                      {buttonSizes.map((size) => (
                        <div key={size} className='flex flex-col items-center gap-2'>
                          <Button intent={intent} size={size}>
                            {size}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Badges Section */}
            <div className='space-y-12'>
              <div className='border-b border-white/10 pb-4'>
                <h3 className={typographyStyles.subheadline}>Badges</h3>
                <p className={typographyStyles.caption}>Status & Labeling</p>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
                {badgeIntents.map((intent) => (
                  <div
                    key={intent}
                    className='p-6 space-y-4 rounded-2xl bg-white/[0.02] border border-white/5'
                  >
                    <p className='text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]'>
                      {intent}
                    </p>
                    <div className='flex flex-wrap items-center gap-3'>
                      {badgeSizes.map((size) => (
                        <Badge key={size} intent={intent} size={size}>
                          {size}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cards Section */}
            <div className='space-y-12'>
              <div className='border-b border-white/10 pb-4'>
                <h3 className={typographyStyles.subheadline}>Cards</h3>
                <p className={typographyStyles.caption}>Elevation & Material</p>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                {cardIntents.map((intent) => (
                  <Card key={intent} intent={intent} className='p-10 space-y-6'>
                    <Badge intent='glass' size='sm'>
                      {intent}
                    </Badge>
                    <h4 className={typographyStyles.subheadline}>Architectural Surface</h4>
                    <p className={typographyStyles.body}>
                      Demonstrating the {intent} surface variant with adaptive glass effects and
                      precise border tokens.
                    </p>
                    <div className='flex gap-4'>
                      <Button intent='primary' size='sm'>
                        View Details
                      </Button>
                      <Button intent='ghost' size='sm'>
                        Specs
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Typography Section */}
            <div className='space-y-12'>
              <div className='border-b border-white/10 pb-4'>
                <h3 className={typographyStyles.subheadline}>Typography</h3>
                <p className={typographyStyles.caption}>Rhythm & Scale</p>
              </div>

              <div className='space-y-16 p-12 rounded-[2rem] bg-black/40 border border-white/5'>
                <div className='space-y-2'>
                  <p className='text-[10px] font-mono text-primary uppercase tracking-[0.3em]'>
                    Display
                  </p>
                  <h1 className={typographyStyles.display}>Hyper-fluid interfaces.</h1>
                </div>

                <div className='space-y-2'>
                  <p className='text-[10px] font-mono text-primary uppercase tracking-[0.3em]'>
                    Headline
                  </p>
                  <h2 className={typographyStyles.headline}>Precision-engineered design.</h2>
                </div>

                <div className='grid md:grid-cols-2 gap-16'>
                  <div className='space-y-4'>
                    <p className='text-[10px] font-mono text-primary uppercase tracking-[0.3em]'>
                      Subheadline
                    </p>
                    <h3 className={typographyStyles.subheadline}>Component Architecture</h3>
                    <p className={typographyStyles.body}>
                      Every element is derived from a strict set of geometric and functional tokens.
                    </p>
                  </div>
                  <div className='space-y-4'>
                    <p className='text-[10px] font-mono text-primary uppercase tracking-[0.3em]'>
                      Body Text
                    </p>
                    <p className={typographyStyles.body}>
                      The body scale promotes maximum readability while maintaining a sophisticated
                      technological aesthetic. Leveraging system fonts for zero layout shift.
                    </p>
                    <p className={typographyStyles.caption}>
                      Build metadata: v1.0.0-alpha · 2026.04.09
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ─── Footer Placeholder ─────────────────────────────────────────────── */}
      <footer className='py-32 text-center'>
        <Container>
          <p className={typographyStyles.caption}>
            © 2026 Light Project · Designed for architectural purity
          </p>
        </Container>
      </footer>
    </div>
  );
};

export type { PreviewProps };
export { Preview };
