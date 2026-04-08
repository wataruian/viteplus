import { Badge, type BadgeProps } from './badge';
import { Beam, type BeamProps } from './beam';
import { Button, type ButtonProps } from './button';
import { Container, type ContainerProps, Section } from './layout';
import type { HTMLAttributes, ReactNode } from 'react';
import { Noise, type NoiseProps } from './noise';
import { getSlotClass } from '../utils/styles';

export interface HeroProps {
  title?: string | ReactNode;
  subtitle?: string;
  badge?: string;
  primaryAction?: { href?: string; onClick?: () => void; text: string };
  secondaryAction?: { href?: string; onClick?: () => void; text: string };
  children?: ReactNode;
  className?: string;
  props?: HTMLAttributes<HTMLElement>;
  useDefault?: boolean;
  noiseProps?: NoiseProps;
  radialGlowProps?: HTMLAttributes<HTMLDivElement>;
  beamWrapperProps?: HTMLAttributes<HTMLDivElement>;
  beamGlow1Props?: HTMLAttributes<HTMLDivElement>;
  beamGlow2Props?: HTMLAttributes<HTMLDivElement>;
  containerProps?: ContainerProps;
  badgeWrapperProps?: HTMLAttributes<HTMLDivElement>;
  badgeProps?: BadgeProps;
  titleProps?: HTMLAttributes<HTMLHeadingElement>;
  subtitleProps?: HTMLAttributes<HTMLParagraphElement>;
  actionsWrapperProps?: HTMLAttributes<HTMLDivElement>;
  primaryButtonProps?: ButtonProps;
  secondaryButtonProps?: ButtonProps;
  beam1Props?: HTMLAttributes<HTMLDivElement>;
  beam2Props?: HTMLAttributes<HTMLDivElement>;
  beam3Props?: HTMLAttributes<HTMLDivElement>;
}

export const defaultInternalClasses = {
  actionsWrapper: 'flex flex-wrap items-center justify-center gap-6',
  badge: 'mb-10 bg-white/5 border-white/10 px-6 py-2 tracking-wide font-bold',
  badgeProps: { size: 'lg', variant: 'accent' } as BadgeProps,
  badgeWrapper: '',
  beam1: '',
  beam1Props: { delay: '0s', duration: '10s', size: 'lg', top: '15%' } as Partial<BeamProps>,
  beam2: 'opacity-50',
  beam2Props: { delay: '3s', duration: '12s', size: 'md', top: '35%' } as Partial<BeamProps>,
  beam3: 'opacity-30',
  beam3Props: { delay: '6s', duration: '8s', size: 'sm', top: '65%' } as Partial<BeamProps>,
  beamGlow1:
    'absolute top-[-5%] left-[-10%] w-[60%] h-[60%] bg-primary/5 blur-[100px] rounded-full',
  beamGlow2:
    'absolute bottom-[5%] right-[-5%] w-[50%] h-[50%] bg-accent/5 blur-[100px] rounded-full',
  beamGlow2Delay: '2s',
  beamWrapper:
    'absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-full -z-10 pointer-events-none',
  container: 'text-center relative z-10',
  containerActionsDelay: '0.3s',
  containerSubtitleDelay: '0.2s',
  containerTitleDelay: '0.1s',
  noise: 'opacity-[0.02]',
  primaryButton: 'min-w-[220px] h-16 text-xl',
  primaryButtonIcon: 'i-ph-arrow-right-bold',
  primaryButtonProps: {
    size: 'lg',
    variant: 'premium',
  } as ButtonProps,
  radialGlow:
    'absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary),0.1),transparent_70%)]',
  secondaryButton:
    'min-w-[220px] h-16 text-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05]',
  secondaryButtonProps: { size: 'lg', variant: 'ghost' } as ButtonProps,
  subtitle:
    'text-xl md:text-2xl text-slate-400 max-w-4xl mx-auto mb-14 leading-relaxed font-medium',
  title:
    'text-6xl md:text-[min(120px,12vw)] font-black mb-10 leading-[0.9] tracking-tighter text-white font-header',
};

export const defaultClasses = 'pt-40 pb-24 overflow-hidden relative min-h-[90vh] flex items-center';

export const Hero = ({
  title,
  subtitle,
  badge,
  primaryAction,
  secondaryAction,
  children,
  className = '',
  useDefault = true,
  noiseProps,
  radialGlowProps,
  beamWrapperProps,
  beamGlow1Props,
  beamGlow2Props,
  containerProps,
  badgeWrapperProps,
  badgeProps,
  titleProps,
  subtitleProps,
  actionsWrapperProps,
  primaryButtonProps,
  secondaryButtonProps,
  beam1Props,
  beam2Props,
  beam3Props,
  props: rootProps,
}: HeroProps) => {
  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;

  return (
    <Section props={rootProps} className={finalClassName}>
      {useDefault ? (
        <>
          <Noise
            {...noiseProps}
            className={getSlotClass(useDefault, defaultInternalClasses.noise, noiseProps)}
          />
          <div
            {...radialGlowProps}
            className={getSlotClass(useDefault, defaultInternalClasses.radialGlow, radialGlowProps)}
          />

          <div
            {...beamWrapperProps}
            className={getSlotClass(
              useDefault,
              defaultInternalClasses.beamWrapper,
              beamWrapperProps,
            )}
          >
            <div
              {...beamGlow1Props}
              className={getSlotClass(useDefault, defaultInternalClasses.beamGlow1, beamGlow1Props)}
            />
            <div
              {...beamGlow2Props}
              className={getSlotClass(useDefault, defaultInternalClasses.beamGlow2, beamGlow2Props)}
              style={{
                animationDelay: defaultInternalClasses.beamGlow2Delay,
                ...beamGlow2Props?.style,
              }}
            />
            <Beam
              useDefault={useDefault}
              {...defaultInternalClasses.beam1Props}
              {...beam1Props}
              className={getSlotClass(useDefault, defaultInternalClasses.beam1, beam1Props)}
            />
            <Beam
              useDefault={useDefault}
              {...defaultInternalClasses.beam2Props}
              {...beam2Props}
              className={getSlotClass(useDefault, defaultInternalClasses.beam2, beam2Props)}
            />
            <Beam
              useDefault={useDefault}
              {...defaultInternalClasses.beam3Props}
              {...beam3Props}
              className={getSlotClass(useDefault, defaultInternalClasses.beam3, beam3Props)}
            />
          </div>

          <Container
            {...containerProps}
            className={getSlotClass(useDefault, defaultInternalClasses.container, containerProps)}
          >
            {Boolean(badge) && (
              <div
                {...badgeWrapperProps}
                className={getSlotClass(
                  useDefault,
                  defaultInternalClasses.badgeWrapper,
                  badgeWrapperProps,
                )}
              >
                <Badge
                  useDefault={useDefault}
                  {...defaultInternalClasses.badgeProps}
                  {...badgeProps}
                  className={getSlotClass(useDefault, defaultInternalClasses.badge, badgeProps)}
                >
                  {badge}
                </Badge>
              </div>
            )}

            {Boolean(title) && (
              <h1
                {...titleProps}
                className={getSlotClass(useDefault, defaultInternalClasses.title, titleProps)}
                style={{
                  animationDelay: defaultInternalClasses.containerTitleDelay,
                  ...titleProps?.style,
                }}
              >
                {title}
              </h1>
            )}

            {Boolean(subtitle) && (
              <p
                {...subtitleProps}
                className={getSlotClass(useDefault, defaultInternalClasses.subtitle, subtitleProps)}
                style={{
                  animationDelay: defaultInternalClasses.containerSubtitleDelay,
                  ...subtitleProps?.style,
                }}
              >
                {subtitle}
              </p>
            )}

            <div
              {...actionsWrapperProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.actionsWrapper,
                actionsWrapperProps,
              )}
              style={{
                animationDelay: defaultInternalClasses.containerActionsDelay,
                ...actionsWrapperProps?.style,
              }}
            >
              {primaryAction && (
                <Button
                  useDefault={useDefault}
                  {...defaultInternalClasses.primaryButtonProps}
                  {...primaryButtonProps}
                  className={getSlotClass(
                    useDefault,
                    defaultInternalClasses.primaryButton,
                    primaryButtonProps,
                  )}
                  href={primaryAction.href}
                  rightIcon={defaultInternalClasses.primaryButtonIcon}
                  onClick={primaryAction.onClick}
                >
                  {primaryAction.text}
                </Button>
              )}
              {secondaryAction && (
                <Button
                  useDefault={useDefault}
                  {...defaultInternalClasses.secondaryButtonProps}
                  {...secondaryButtonProps}
                  className={getSlotClass(
                    useDefault,
                    defaultInternalClasses.secondaryButton,
                    secondaryButtonProps,
                  )}
                  href={secondaryAction.href}
                  onClick={secondaryAction.onClick}
                >
                  {secondaryAction.text}
                </Button>
              )}
            </div>
            {children}
          </Container>
        </>
      ) : (
        children
      )}
    </Section>
  );
};
