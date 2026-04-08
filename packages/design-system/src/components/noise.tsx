import type { HTMLAttributes, ReactNode } from 'react';
import { getSlotClass } from '../utils/styles';

export interface NoiseProps {
  children?: ReactNode | undefined;
  className?: string | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  useDefault?: boolean | undefined;
}

export const defaultInternalClasses = {
  noiseUrl:
    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
};

export const defaultClasses =
  'absolute inset-0 w-full h-full pointer-events-none opacity-[0.03] mix-blend-overlay';

export const Noise = ({
  children,
  className = '',
  useDefault = true,
  props: rootProps,
}: NoiseProps) => {
  const finalClassName = getSlotClass(useDefault, defaultClasses, { className });

  return (
    <div
      {...rootProps}
      className={getSlotClass(useDefault, finalClassName, rootProps)}
      style={{
        backgroundImage: useDefault ? defaultInternalClasses.noiseUrl : undefined,
        ...rootProps?.style,
      }}
    >
      {children}
    </div>
  );
};
