import type { HTMLAttributes, ReactNode } from 'react';
import { Noise, type NoiseProps } from './noise';
import { getSlotClass } from '../utils/styles';

export interface LayoutProps {
  children?: ReactNode;
  className?: string;
  props?: HTMLAttributes<HTMLElement> | undefined;
  useDefault?: boolean;
}

export interface ContainerProps {
  children?: ReactNode;
  className?: string;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  useDefault?: boolean;
}

export const containerDefaultClasses = 'max-w-[1400px] mx-auto px-6 md:px-10';
export const sectionDefaultClasses = 'py-24 md:py-40 relative overflow-hidden';

export const defaultInternalClasses = {
  container: containerDefaultClasses,
  navbarContainer: 'w-full flex items-center justify-between',
  section: sectionDefaultClasses,
};

export const Container = ({
  children,
  className = '',
  props: rootProps,
  useDefault = true,
}: ContainerProps) => {
  const finalClassName = useDefault ? `${containerDefaultClasses} ${className}` : className;

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {children}
    </div>
  );
};

export const Section = ({
  children,
  className = '',
  props: rootProps,
  useDefault = true,
}: LayoutProps) => {
  const finalClassName = useDefault ? `${sectionDefaultClasses} ${className}` : className;

  return (
    <section {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {children}
    </section>
  );
};

export interface NavbarProps {
  children?: ReactNode;
  className?: string;
  containerProps?: ContainerProps;
  props?: HTMLAttributes<HTMLElement> | undefined;
  useDefault?: boolean;
}

export const navbarDefaultClasses = 'h-20 flex items-center';

export const Navbar = ({
  children,
  className = '',
  containerProps,
  props: rootProps,
  useDefault = true,
}: NavbarProps) => {
  const finalClassName = useDefault ? `${navbarDefaultClasses} ${className}` : className;

  return (
    <nav {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <Container
          {...containerProps}
          className={getSlotClass(
            useDefault,
            defaultInternalClasses.navbarContainer,
            containerProps,
          )}
        >
          {children}
        </Container>
      ) : (
        children
      )}
    </nav>
  );
};

export interface MeshBackgroundProps {
  children?: ReactNode;
  className?: string;
  glow1Props?: HTMLAttributes<HTMLDivElement> | undefined;
  glow2Props?: HTMLAttributes<HTMLDivElement> | undefined;
  glow3Props?: HTMLAttributes<HTMLDivElement> | undefined;
  gradientProps?: HTMLAttributes<HTMLDivElement> | undefined;
  noiseProps?: NoiseProps | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  useDefault?: boolean;
}

export const meshDefaultInternalClasses = {
  glow1: 'absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-primary/10 blur-[80px] rounded-full',
  glow2: 'absolute bottom-[0%] right-[-10%] w-[60%] h-[60%] bg-accent/10 blur-[80px] rounded-full',
  glow2Delay: '2s',
  glow3: 'absolute top-[30%] left-[40%] w-[30%] h-[30%] bg-primary/10 blur-[60px] rounded-full',
  glow3Delay: '1s',
  gradient: 'absolute inset-0 bg-gradient-to-b from-transparent',
  noise: 'opacity-[0.03]',
};

export const meshDefaultClasses = 'fixed inset-0 -z-20 overflow-hidden pointer-events-none';

export const MeshBackground = ({
  children,
  className = '',
  glow1Props,
  glow2Props,
  glow3Props,
  gradientProps,
  noiseProps,
  props: rootProps,
  useDefault = true,
}: MeshBackgroundProps) => {
  const finalClassName = useDefault ? `${meshDefaultClasses} ${className}` : className;

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <>
          <Noise
            {...noiseProps}
            className={getSlotClass(useDefault, meshDefaultInternalClasses.noise, noiseProps)}
          />
          <div
            {...glow1Props}
            className={getSlotClass(useDefault, meshDefaultInternalClasses.glow1, glow1Props)}
          />
          <div
            {...glow2Props}
            className={getSlotClass(useDefault, meshDefaultInternalClasses.glow2, glow2Props)}
            style={{ animationDelay: meshDefaultInternalClasses.glow2Delay, ...glow2Props?.style }}
          />
          <div
            {...glow3Props}
            className={getSlotClass(useDefault, meshDefaultInternalClasses.glow3, glow3Props)}
            style={{ animationDelay: meshDefaultInternalClasses.glow3Delay, ...glow3Props?.style }}
          />
          <div
            {...gradientProps}
            className={getSlotClass(useDefault, meshDefaultInternalClasses.gradient, gradientProps)}
          />
        </>
      ) : null}
      {children}
    </div>
  );
};
