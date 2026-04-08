import type { HTMLAttributes, ReactNode } from 'react';
import { getSlotClass } from '../utils/styles';

export interface MarqueeProps {
  children?: ReactNode | undefined;
  direction?: 'left' | 'right' | undefined;
  speed?: number | undefined;
  pauseOnHover?: boolean | undefined;
  className?: string | undefined;
  useDefault?: boolean | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  contentProps?: HTMLAttributes<HTMLDivElement> | undefined;
}

export const defaultInternalClasses = {
  contentBase: 'flex min-w-full shrink-0 items-center justify-around gap-12',
  icon: 'text-3xl text-slate-400 group-hover/item:text-primary-400 transition-colors duration-300',
  text: 'text-lg font-semibold text-slate-500 group-hover/item:text-white transition-colors duration-300 font-header uppercase tracking-widest',
};

export const defaultClasses =
  'group relative flex overflow-hidden py-10 w-full opacity-90 hover:opacity-100 transition-opacity duration-700';

export const getContentClasses = (
  direction: MarqueeProps['direction'],
  pauseOnHover: MarqueeProps['pauseOnHover'],
) =>
  `${defaultInternalClasses.contentBase} ${
    direction === 'left' ? 'animate-scroll-left' : 'animate-scroll-right'
  } ${pauseOnHover === true ? 'group-hover:pause' : ''}`;

export const Marquee = ({
  children,
  direction = 'left',
  speed = 10,
  pauseOnHover = true,
  className = '',
  useDefault = true,
  props: rootProps,
  contentProps,
}: MarqueeProps) => {
  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;
  const contentClasses = getContentClasses(direction, pauseOnHover);

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <>
          <div
            {...contentProps}
            className={getSlotClass(useDefault, contentClasses, contentProps)}
            style={{ animationDuration: `${speed}s`, ...contentProps?.style }}
          >
            {children}
            {children}
          </div>
          <div
            {...contentProps}
            className={getSlotClass(useDefault, contentClasses, contentProps)}
            aria-hidden='true'
            style={{ animationDuration: `${speed}s`, ...contentProps?.style }}
          >
            {children}
            {children}
          </div>
        </>
      ) : (
        children
      )}
    </div>
  );
};

export interface MarqueeItemProps {
  icon?: string | undefined;
  text?: string | undefined;
  children?: ReactNode | undefined;
  className?: string | undefined;
  useDefault?: boolean | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  iconProps?: HTMLAttributes<HTMLDivElement> | undefined;
  textProps?: HTMLAttributes<HTMLSpanElement> | undefined;
}

export const itemDefaultClasses =
  'flex items-center gap-4 px-8 py-4 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 hover:border-white/20 whitespace-nowrap cursor-default';

export const MarqueeItem = ({
  icon,
  text,
  children,
  className = '',
  useDefault = true,
  iconProps,
  textProps,
  props: rootProps,
}: MarqueeItemProps) => {
  const finalClassName = useDefault ? `${itemDefaultClasses} ${className}` : className;

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <>
          {Boolean(icon) && (
            <div
              {...iconProps}
              className={getSlotClass(
                useDefault,
                `${icon} ${defaultInternalClasses.icon}`,
                iconProps,
              )}
            ></div>
          )}
          {Boolean(text) && (
            <span
              {...textProps}
              className={getSlotClass(useDefault, defaultInternalClasses.text, textProps)}
            >
              {text}
            </span>
          )}

          {children}
        </>
      ) : (
        children
      )}
    </div>
  );
};
