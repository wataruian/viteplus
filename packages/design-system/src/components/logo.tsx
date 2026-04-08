import type { HTMLAttributes, ReactNode } from 'react';
import { getSlotClass } from '../utils/styles';

export interface LogoProps {
  children?: ReactNode;
  className?: string;
  iconBgProps?: HTMLAttributes<HTMLDivElement>;
  iconCenterProps?: HTMLAttributes<HTMLDivElement>;
  iconGlowProps?: HTMLAttributes<HTMLDivElement>;
  iconGradientProps?: HTMLAttributes<HTMLDivElement>;
  iconWrapperProps?: HTMLAttributes<HTMLDivElement>;
  props?: HTMLAttributes<HTMLDivElement>;
  textTop?: string | undefined;
  textTopProps?: HTMLAttributes<HTMLSpanElement>;
  textBottom?: string | undefined;
  textBottomProps?: HTMLAttributes<HTMLSpanElement>;
  textWrapperProps?: HTMLAttributes<HTMLDivElement>;
  useDefault?: boolean;
}

export const defaultInternalClasses = {
  iconBg:
    'absolute inset-0 border-2 border-black/10 dark:border-white/20 rounded-2xl group-hover:border-primary transition-colors duration-700',
  iconCenter: 'relative z-10 w-6 h-6 rounded-lg',
  iconGlow:
    'absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full blur-[8px] opacity-0 group-hover:opacity-100 transition-opacity duration-700',
  iconGradient:
    'absolute inset-0 bg-gradient-to-tr from-primary-600 via-primary-400 to-accent rounded-2xl rotate-12 opacity-80 blur-[2px] group-hover:rotate-0 transition-transform duration-700',
  iconWrapper:
    'relative w-12 h-12 flex items-center justify-center transition-all duration-700 group-hover:rotate-[360deg]',
  textBottom:
    'text-sm font-bold tracking-[0.2em] text-primary font-header uppercase leading-none opacity-70',
  textBottomContent: 'Brand',
  textTop:
    'text-2xl font-extrabold tracking-tighter text-primary font-header uppercase leading-none opacity-90',
  textTopContent: 'Logo',
  textWrapper: 'flex flex-col -gap-1',
};

export const defaultClasses = 'flex items-center gap-4 cursor-pointer';

export const Logo = ({
  children,
  className = '',
  iconBgProps,
  iconCenterProps,
  iconGlowProps,
  iconGradientProps,
  iconWrapperProps,
  textTop,
  textTopProps,
  textBottom,
  textBottomProps,
  textWrapperProps,
  useDefault = true,
  props: rootProps,
}: LogoProps) => {
  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <>
          <div
            {...iconWrapperProps}
            className={getSlotClass(
              useDefault,
              defaultInternalClasses.iconWrapper,
              iconWrapperProps,
            )}
          >
            <div
              {...iconGradientProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.iconGradient,
                iconGradientProps,
              )}
            ></div>
            <div
              {...iconBgProps}
              className={getSlotClass(useDefault, defaultInternalClasses.iconBg, iconBgProps)}
            ></div>
            <div
              {...iconCenterProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.iconCenter,
                iconCenterProps,
              )}
            ></div>
            <div
              {...iconGlowProps}
              className={getSlotClass(useDefault, defaultInternalClasses.iconGlow, iconGlowProps)}
            ></div>
          </div>
          <div
            {...textWrapperProps}
            className={getSlotClass(
              useDefault,
              defaultInternalClasses.textWrapper,
              textWrapperProps,
            )}
          >
            <span
              {...textTopProps}
              className={getSlotClass(useDefault, defaultInternalClasses.textTop, textTopProps)}
            >
              {textTop ?? defaultInternalClasses.textTopContent}
            </span>
            <span
              {...textBottomProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.textBottom,
                textBottomProps,
              )}
            >
              {textBottom ?? defaultInternalClasses.textBottomContent}
            </span>
          </div>
          {children}
        </>
      ) : (
        children
      )}
    </div>
  );
};
