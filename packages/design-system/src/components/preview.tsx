import type { HTMLAttributes, ReactNode } from 'react';
import { Header } from './header';
import { Section } from './layout';
import { getSlotClass } from '../utils/styles';
import { getWeights } from '../utils';

export interface ColorSquareProps {
  variable: string;
  label: string;
  className?: string | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  innerProps?: HTMLAttributes<HTMLDivElement> | undefined;
  labelProps?: HTMLAttributes<HTMLDivElement> | undefined;
  variableProps?: HTMLAttributes<HTMLDivElement> | undefined;
  useDefault?: boolean | undefined;
}

export const colorSquareInternalClasses = {
  inner:
    'h-20 w-full rounded-xl border border-solid border-white/20 dark:border-black/20 transition-transform hover:scale-105 duration-300',
  label: 'flex items-center justify-center h-full font-bold font-mono text-sm tracking-tight',
  root: 'flex flex-col gap-2',
  variable: 'text-[10px] font-mono uppercase truncate opacity-80',
};

export const ColorSquare = ({
  variable,
  label,
  className = '',
  props: rootProps,
  innerProps,
  labelProps,
  variableProps,
  useDefault = true,
}: ColorSquareProps) => {
  const step = Number.parseInt(label, 10);
  const isDark = step >= 500;

  return (
    <div
      {...rootProps}
      className={getSlotClass(
        useDefault,
        `${colorSquareInternalClasses.root} ${className}`,
        rootProps,
      )}
    >
      <div
        {...innerProps}
        className={getSlotClass(useDefault, colorSquareInternalClasses.inner, innerProps)}
        style={{ backgroundColor: `rgb(var(${variable}))`, ...innerProps?.style }}
      >
        <div
          {...labelProps}
          className={getSlotClass(
            useDefault,
            `${colorSquareInternalClasses.label} ${isDark ? 'text-white' : 'text-black'}`,
            labelProps,
          )}
        >
          {label}
        </div>
      </div>
      <div
        {...variableProps}
        className={getSlotClass(useDefault, colorSquareInternalClasses.variable, variableProps)}
      >
        {variable}
      </div>
    </div>
  );
};

export interface PreviewProps {
  children?: ReactNode | undefined;
  className?: string | undefined;
  useDefault?: boolean | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  mainProps?: HTMLAttributes<HTMLElement> | undefined;
  paletteWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  paletteKeyProps?: HTMLAttributes<HTMLDivElement> | undefined;
  paletteGridProps?: HTMLAttributes<HTMLDivElement> | undefined;
}

export const previewDefaultInternalClasses = {
  main: 'max-w-7xl mx-auto px-6 pt-20',
  paletteGrid:
    'grid grid-cols-2 md:grid-cols-6 lg:grid-cols-11 gap-4 p-8 rounded-[2rem] border border-white/10 dark:border-black/10 shadow-2xl',
  paletteKey: 'text-xs font-bold uppercase mb-4 tracking-widest opacity-50',
  paletteWrapper: 'flex flex-col gap-8',
};

export const previewDefaultClasses = 'min-h-screen font-sans';

export const Preview = ({
  children,
  className = '',
  useDefault = true,
  props: rootProps,
  mainProps,
  paletteWrapperProps,
  paletteKeyProps,
  paletteGridProps,
}: PreviewProps) => {
  const finalClassName = useDefault ? `${previewDefaultClasses} ${className}` : className;

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      <Header />

      <main
        {...mainProps}
        className={getSlotClass(useDefault, previewDefaultInternalClasses.main, mainProps)}
      >
        <Section>
          <div
            {...paletteWrapperProps}
            className={getSlotClass(
              useDefault,
              previewDefaultInternalClasses.paletteWrapper,
              paletteWrapperProps,
            )}
          >
            {['primary', 'accent', 'surface'].map((key) => (
              <div key={key}>
                <div
                  {...paletteKeyProps}
                  className={getSlotClass(
                    useDefault,
                    previewDefaultInternalClasses.paletteKey,
                    paletteKeyProps,
                  )}
                >
                  {key}
                </div>
                <div
                  {...paletteGridProps}
                  className={getSlotClass(
                    useDefault,
                    previewDefaultInternalClasses.paletteGrid,
                    paletteGridProps,
                  )}
                >
                  {Object.keys(getWeights()).map((step) => (
                    <ColorSquare
                      key={`${key}-${step}`}
                      variable={`--${key}-${step}`}
                      label={step}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
        {children}
      </main>
    </div>
  );
};
