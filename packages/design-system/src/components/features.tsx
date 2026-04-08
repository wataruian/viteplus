import { Container, Section } from './layout';
import type { HTMLAttributes, ReactNode } from 'react';
import { getSlotClass } from '../utils/styles';

interface Feature {
  title: string;
  description: string;
  icon: string;
  span?: string;
}

interface FeaturesProps {
  title?: string;
  subtitle?: string;
  features?: Feature[];
  children?: ReactNode;
  className?: string;
  useDefault?: boolean;
  props?: HTMLAttributes<HTMLElement> | undefined;
  headerWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  titleProps?: HTMLAttributes<HTMLHeadingElement> | undefined;
  subtitleProps?: HTMLAttributes<HTMLParagraphElement> | undefined;
  gridProps?: HTMLAttributes<HTMLDivElement> | undefined;
  featureItemProps?: HTMLAttributes<HTMLDivElement> | undefined;
  featureIconWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  featureIconProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  featureTitleProps?: HTMLAttributes<HTMLHeadingElement> | undefined;
  featureDescriptionProps?: HTMLAttributes<HTMLParagraphElement> | undefined;
  featureGradientProps?: HTMLAttributes<HTMLDivElement> | undefined;
  featureContentWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
}

export const defaultInternalClasses = {
  featureContentWrapper: 'relative z-10',
  featureDescription: 'text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors',
  featureGradient:
    'absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500',
  featureIcon: 'text-3xl text-primary-400 group-hover:text-primary-300',
  featureIconWrapper:
    'w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-8 group-hover:bg-primary-500/10 group-hover:scale-110 transition-all duration-500',
  featureItem:
    'p-10 flex flex-col justify-end group border-white/5 hover:border-primary-500/30 transition-all duration-500',
  featureTitle: 'text-2xl font-bold text-white mb-4 group-hover:text-primary-300 transition-colors',
  grid: 'grid grid-cols-3 gap-4',
  headerWrapper: 'text-center mb-20',
  subtitle: 'text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed',
  title: 'text-4xl md:text-5xl font-black text-white mb-6 font-header tracking-tight',
};

export const defaultClasses = 'bg-primary-900/50';

export const Features = ({
  title,
  subtitle,
  features = [],
  children,
  className = '',
  useDefault = true,
  headerWrapperProps,
  titleProps,
  subtitleProps,
  gridProps,
  featureItemProps,
  featureIconWrapperProps,
  featureIconProps,
  featureTitleProps,
  featureDescriptionProps,
  featureGradientProps,
  featureContentWrapperProps,
  props: rootProps,
}: FeaturesProps) => {
  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;

  return (
    <Section props={rootProps} className={finalClassName}>
      {useDefault ? (
        <Container>
          {(Boolean(title) || Boolean(subtitle)) && (
            <div
              {...headerWrapperProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.headerWrapper,
                headerWrapperProps,
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
            </div>
          )}

          <div
            {...gridProps}
            className={getSlotClass(useDefault, defaultInternalClasses.grid, gridProps)}
          >
            {features.map((feature, idx) => (
              <div
                key={idx}
                {...featureItemProps}
                className={getSlotClass(
                  useDefault,
                  `${defaultInternalClasses.featureItem} ${feature.span ?? ''}`,
                  featureItemProps,
                )}
              >
                <div
                  {...featureGradientProps}
                  className={getSlotClass(
                    useDefault,
                    defaultInternalClasses.featureGradient,
                    featureGradientProps,
                  )}
                />

                <div
                  {...featureContentWrapperProps}
                  className={getSlotClass(
                    useDefault,
                    defaultInternalClasses.featureContentWrapper,
                    featureContentWrapperProps,
                  )}
                >
                  <div
                    {...featureIconWrapperProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.featureIconWrapper,
                      featureIconWrapperProps,
                    )}
                  >
                    <span
                      {...featureIconProps}
                      className={getSlotClass(
                        useDefault,
                        `${feature.icon} ${defaultInternalClasses.featureIcon}`,
                        featureIconProps,
                      )}
                    ></span>
                  </div>
                  <h3
                    {...featureTitleProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.featureTitle,
                      featureTitleProps,
                    )}
                  >
                    {feature.title}
                  </h3>
                  <p
                    {...featureDescriptionProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.featureDescription,
                      featureDescriptionProps,
                    )}
                  >
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {children}
        </Container>
      ) : (
        children
      )}
    </Section>
  );
};
