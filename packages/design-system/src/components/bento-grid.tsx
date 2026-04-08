import type { HTMLAttributes, ReactNode } from 'react';
import { getSlotClass } from '../utils/styles';

interface BentoGridProps {
  children?: ReactNode | undefined;
  className?: string | undefined;
  useDefault?: boolean | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
}

export const bentoGridDefaultClasses = 'grid grid-cols-3 gap-4';

export const BentoGrid = ({
  children,
  className = '',
  useDefault = true,
  props: rootProps,
}: BentoGridProps) => {
  const finalClassName = useDefault ? `${bentoGridDefaultClasses} ${className}` : className;

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {children}
    </div>
  );
};

interface BentoItemProps {
  title?: string | undefined;
  description?: string | undefined;
  icon?: string | undefined;
  children?: ReactNode | undefined;
  span?: string | undefined;
  className?: string | undefined;
  useDefault?: boolean | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  contentWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  iconWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  iconProps?: HTMLAttributes<HTMLDivElement> | undefined;
  titleProps?: HTMLAttributes<HTMLHeadingElement> | undefined;
  descriptionProps?: HTMLAttributes<HTMLParagraphElement> | undefined;
  childrenWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  gradientProps?: HTMLAttributes<HTMLDivElement> | undefined;
  glowProps?: HTMLAttributes<HTMLDivElement> | undefined;
}

export const bentoItemDefaultInternalClasses = {
  childrenWrapper: 'mt-auto pt-8',
  contentWrapper: 'p-8 flex flex-col h-full',
  description: 'text-lg text-slate-400 leading-relaxed font-medium',
  glow: 'absolute -bottom-10 -right-10 w-40 h-40 bg-primary-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none',
  gradient:
    'absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none',
  icon: 'text-2xl',
  iconWrapper:
    'w-14 h-14 glass-border mb-8 text-primary-400 group-hover:scale-110 transition-transform duration-500',
  title:
    'text-3xl font-extrabold text-white mb-4 tracking-tight font-header transition-all duration-300 group-hover:text-primary-300',
};

export const bentoItemDefaultClasses = 'bento-item';

export const BentoItem = ({
  title,
  description,
  icon,
  children,
  className = '',
  span = 'col-span-1',
  useDefault = true,
  contentWrapperProps,
  iconWrapperProps,
  iconProps,
  titleProps,
  descriptionProps,
  childrenWrapperProps,
  gradientProps,
  glowProps,
  props: rootProps,
}: BentoItemProps) => {
  const finalClassName = useDefault ? `${bentoItemDefaultClasses} ${span} ${className}` : className;

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <>
          <div
            {...contentWrapperProps}
            className={getSlotClass(
              useDefault,
              bentoItemDefaultInternalClasses.contentWrapper,
              contentWrapperProps,
            )}
          >
            {Boolean(icon) && (
              <div
                {...iconWrapperProps}
                className={getSlotClass(
                  useDefault,
                  bentoItemDefaultInternalClasses.iconWrapper,
                  iconWrapperProps,
                )}
              >
                <div
                  {...iconProps}
                  className={getSlotClass(
                    useDefault,
                    `${icon ?? ''} ${bentoItemDefaultInternalClasses.icon}`,
                    iconProps,
                  )}
                />
              </div>
            )}

            {Boolean(title) && (
              <h3
                {...titleProps}
                className={getSlotClass(
                  useDefault,
                  bentoItemDefaultInternalClasses.title,
                  titleProps,
                )}
              >
                {title}
              </h3>
            )}
            {Boolean(description) && (
              <p
                {...descriptionProps}
                className={getSlotClass(
                  useDefault,
                  bentoItemDefaultInternalClasses.description,
                  descriptionProps,
                )}
              >
                {description}
              </p>
            )}
            {Boolean(children) && (
              <div
                {...childrenWrapperProps}
                className={getSlotClass(
                  useDefault,
                  bentoItemDefaultInternalClasses.childrenWrapper,
                  childrenWrapperProps,
                )}
              >
                {children}
              </div>
            )}
          </div>

          <div
            {...gradientProps}
            className={getSlotClass(
              useDefault,
              bentoItemDefaultInternalClasses.gradient,
              gradientProps,
            )}
          />
          <div
            {...glowProps}
            className={getSlotClass(useDefault, bentoItemDefaultInternalClasses.glow, glowProps)}
          />
        </>
      ) : (
        children
      )}
    </div>
  );
};
