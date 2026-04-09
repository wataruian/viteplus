import type { BaseComponentProps } from '../types/component';
import type { HTMLAttributes } from 'react';
import { getSlotClass } from '../utils/styles';
import { layoutStyles } from '../tokens/variants';

// ─── Container ───────────────────────────────────────────────────────────────

type ContainerProps = BaseComponentProps<HTMLAttributes<HTMLDivElement>>;

const Container = ({ children, className = '', props, useDefault = true }: ContainerProps) => {
  const finalClassName = useDefault ? `${layoutStyles.container} ${className}` : className;

  return (
    <div {...props} className={getSlotClass(useDefault, finalClassName, props)}>
      {children}
    </div>
  );
};

// ─── Section ─────────────────────────────────────────────────────────────────

type SectionProps = BaseComponentProps<HTMLAttributes<HTMLElement>>;

const Section = ({ children, className = '', props, useDefault = true }: SectionProps) => {
  const finalClassName = useDefault ? `${layoutStyles.section} ${className}` : className;

  return (
    <section {...props} className={getSlotClass(useDefault, finalClassName, props)}>
      {children}
    </section>
  );
};

export type { ContainerProps, SectionProps };
export { Container, Section };
