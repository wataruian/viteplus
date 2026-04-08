import { Button, type ButtonProps } from './button';
import { Container, type ContainerProps, Section } from './layout';
import type { HTMLAttributes, ReactNode } from 'react';
import { Noise, type NoiseProps } from './noise';
import { getSlotClass } from '../utils/styles';

export interface CTAProps {
  title?: string;
  subtitle?: string;
  primaryAction?: { text: string; onClick?: () => void };
  secondaryAction?: { text: string; onClick?: () => void };
  children?: ReactNode;
  className?: string;
  useDefault?: boolean;
  props?: HTMLAttributes<HTMLElement> | undefined;
  backgroundWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  backgroundGlowProps?: HTMLAttributes<HTMLDivElement> | undefined;
  containerProps?: ContainerProps | undefined;
  noiseProps?: NoiseProps | undefined;
  contentWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  titleProps?: HTMLAttributes<HTMLHeadingElement> | undefined;
  subtitleProps?: HTMLAttributes<HTMLParagraphElement> | undefined;
  actionsWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  primaryButtonProps?: ButtonProps | undefined;
  secondaryButtonProps?: ButtonProps | undefined;
  childrenWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
}

export const defaultInternalClasses = {
  actionsWrapper: 'flex flex-wrap items-center justify-center gap-8 delay-300',
  backgroundGlow:
    'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-br from-primary-600/20 via-indigo-600/15 to-transparent blur-[120px] rounded-full opacity-60',
  backgroundWrapper:
    'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10',
  childrenWrapper: 'mt-8',
  container:
    'relative z-10 text-center py-20 bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-[4rem] px-8 md:px-24 overflow-hidden',
  contentWrapper: 'max-w-4xl mx-auto',
  primaryButton: 'min-w-[240px] h-16 text-xl scale-110 hover:scale-115 active:scale-105',
  primaryButtonProps: { size: 'lg', variant: 'premium' } as ButtonProps,
  secondaryButton: 'min-w-[240px] h-16 text-xl',
  secondaryButtonProps: { size: 'lg', variant: 'secondary' } as ButtonProps,
  subtitle: 'text-xl md:text-2xl text-slate-400 mb-14 leading-relaxed delay-200',
  title:
    'text-5xl md:text-8xl font-black text-white mb-10 font-header leading-[0.95] tracking-tight',
};

export const defaultClasses = 'overflow-hidden';

export const CTA = ({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  children,
  className = '',
  useDefault = true,
  backgroundWrapperProps,
  backgroundGlowProps,
  containerProps,
  noiseProps,
  contentWrapperProps,
  titleProps,
  subtitleProps,
  actionsWrapperProps,
  childrenWrapperProps,
  primaryButtonProps,
  secondaryButtonProps,
  props: rootProps,
}: CTAProps) => {
  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;

  return (
    <Section props={rootProps} className={finalClassName}>
      {useDefault ? (
        <>
          <div
            {...backgroundWrapperProps}
            className={getSlotClass(
              useDefault,
              defaultInternalClasses.backgroundWrapper,
              backgroundWrapperProps,
            )}
          >
            <div
              {...backgroundGlowProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.backgroundGlow,
                backgroundGlowProps,
              )}
            ></div>
          </div>

          <Container
            {...containerProps}
            className={getSlotClass(useDefault, defaultInternalClasses.container, containerProps)}
          >
            <Noise {...noiseProps} />

            <div
              {...contentWrapperProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.contentWrapper,
                contentWrapperProps,
              )}
            >
              {Boolean(title) && (
                <h2
                  {...titleProps}
                  className={getSlotClass(useDefault, defaultInternalClasses.title, titleProps)}
                >
                  {title}
                </h2>
              )}
              {Boolean(subtitle) && (
                <p
                  {...subtitleProps}
                  className={getSlotClass(
                    useDefault,
                    defaultInternalClasses.subtitle,
                    subtitleProps,
                  )}
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
              >
                {Boolean(primaryAction) && (
                  <Button
                    useDefault={useDefault}
                    {...defaultInternalClasses.primaryButtonProps}
                    {...primaryButtonProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.primaryButton,
                      primaryButtonProps,
                    )}
                    onClick={primaryAction?.onClick}
                  >
                    {primaryAction?.text}
                  </Button>
                )}
                {Boolean(secondaryAction) && (
                  <Button
                    useDefault={useDefault}
                    {...defaultInternalClasses.secondaryButtonProps}
                    {...secondaryButtonProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.secondaryButton,
                      secondaryButtonProps,
                    )}
                    onClick={secondaryAction?.onClick}
                  >
                    {secondaryAction?.text}
                  </Button>
                )}
              </div>
              {Boolean(children) && (
                <div
                  {...childrenWrapperProps}
                  className={getSlotClass(
                    useDefault,
                    defaultInternalClasses.childrenWrapper,
                    childrenWrapperProps,
                  )}
                >
                  {children}
                </div>
              )}
            </div>
          </Container>
        </>
      ) : (
        children
      )}
    </Section>
  );
};
