import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { layoutStyles } from '../tokens/styles';

// ─── Container ───────────────────────────────────────────────────────────────

const containerVariants = cva(layoutStyles.base, {
  defaultVariants: {
    type: 'container',
  },
  variants: layoutStyles.variants,
});

type ContainerVariants = VariantProps<typeof containerVariants>;

interface ContainerProps
  extends BaseComponentProps<HTMLAttributes<HTMLDivElement>>, ContainerVariants {}

const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ children, className = '', props, useDefault = false }, ref) => {
    const finalClass = useDefault ? containerVariants({ className, type: 'container' }) : className;

    return (
      <div {...props} ref={ref} className={finalClass}>
        {children}
      </div>
    );
  },
);

Container.displayName = 'Container';

// ─── Section ─────────────────────────────────────────────────────────────────

const sectionVariants = cva(layoutStyles.base, {
  defaultVariants: {
    type: 'section',
  },
  variants: layoutStyles.variants,
});

type SectionVariants = VariantProps<typeof sectionVariants>;

interface SectionProps extends BaseComponentProps<HTMLAttributes<HTMLElement>>, SectionVariants {}

const Section = forwardRef<HTMLElement, SectionProps>(
  ({ children, className = '', props, useDefault = false }, ref) => {
    const finalClass = useDefault ? sectionVariants({ className, type: 'section' }) : className;

    return (
      <section {...props} ref={ref} className={finalClass}>
        {children}
      </section>
    );
  },
);

Section.displayName = 'Section';

// ─── Exports ─────────────────────────────────────────────────────────────────

export type { ContainerProps, ContainerVariants, SectionProps, SectionVariants };
export { Container, Section, containerVariants, sectionVariants };
