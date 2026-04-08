import type { HTMLAttributes, ReactNode } from 'react';
import { getSlotClass } from '../utils/styles';

export interface BeamProps {
  delay?: string | undefined;
  duration?: string | undefined;
  size?: 'sm' | 'md' | 'lg' | undefined;
  top?: string | undefined;
  useDefault?: boolean | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  innerBeamProps?: HTMLAttributes<HTMLDivElement> | undefined;
  children?: ReactNode | undefined;
  className?: string | undefined;
}

export const defaultInternalClasses = {
  innerBeam: 'bg-gradient-to-r from-transparent via-primary-400/50 to-transparent',
};

export const sizes = {
  lg: 'h-[2px] w-full max-w-[600px]',
  md: 'h-[1px] w-full max-w-[400px]',
  sm: 'h-[1px] w-full max-w-[200px]',
} as const;

export const defaultClasses = 'absolute left-0 overflow-hidden pointer-events-none';

export const Beam = ({
  className = '',
  delay = '0s',
  duration = '8s',
  size = 'md',
  top = '20%',
  useDefault = true,
  children,
  innerBeamProps,
  props: rootProps,
}: BeamProps) => {
  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;

  return (
    <div
      {...rootProps}
      className={getSlotClass(useDefault, finalClassName, rootProps)}
      style={{ top, ...rootProps?.style }}
    >
      {useDefault && (
        <div
          {...innerBeamProps}
          className={getSlotClass(
            useDefault,
            `${defaultInternalClasses.innerBeam} ${sizes[size]}`,
            innerBeamProps,
          )}
          style={{
            animationDelay: delay,
            animationDuration: duration,
            ...innerBeamProps?.style,
          }}
        />
      )}
      {children}
    </div>
  );
};
