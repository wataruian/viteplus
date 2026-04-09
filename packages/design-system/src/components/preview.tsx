import { Container, Section } from './layout';
import { previewContent, previewStyles, typographyStyles } from '../tokens/variants';
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

      <Section>
        <Container>
          <div className={previewStyles.showcaseGrid}>
            <Card
              intent={previewStyles.showcaseCardPremiumIntent}
              className={previewStyles.showcaseCard}
            >
              <h3 className={typographyStyles.subheadline}>{previewContent.cardTitles.buttons}</h3>
              <div className={previewStyles.componentList}>
                <Button intent={previewStyles.showcaseButtonPrimaryIntent}>
                  {previewContent.cardContent.primary}
                </Button>
                <Button intent={previewStyles.showcaseButtonAccentIntent}>
                  {previewContent.cardContent.accent}
                </Button>
                <Button intent={previewStyles.showcaseButtonGlassIntent}>
                  {previewContent.cardContent.glass}
                </Button>
              </div>
            </Card>

            <Card
              intent={previewStyles.showcaseCardGlassIntent}
              className={previewStyles.showcaseCard}
            >
              <h3 className={typographyStyles.subheadline}>{previewContent.cardTitles.badges}</h3>
              <div className={previewStyles.componentList}>
                <Badge intent={previewStyles.showcaseBadgeSuccessIntent}>
                  {previewContent.cardContent.success}
                </Badge>
                <Badge intent={previewStyles.showcaseBadgeWarningIntent}>
                  {previewContent.cardContent.warning}
                </Badge>
                <Badge intent={previewStyles.showcaseBadgeDangerIntent}>
                  {previewContent.cardContent.danger}
                </Badge>
              </div>
            </Card>

            <Card
              intent={previewStyles.showcaseCardOutlineIntent}
              className={previewStyles.showcaseCard}
            >
              <h3 className={typographyStyles.subheadline}>
                {previewContent.cardTitles.typography}
              </h3>
              <p className={typographyStyles.caption}>{previewContent.typoCaption}</p>
              <p className={typographyStyles.body}>{previewContent.typoBody}</p>
            </Card>
          </div>
        </Container>
      </Section>
    </div>
  );
};

export type { PreviewProps };
export { Preview };
