import type { HTMLAttributes, ReactNode } from 'react';
import { getSlotClass } from '../utils/styles';

export interface CardProps {
  children?: ReactNode;
  className?: string;
  props?: HTMLAttributes<HTMLDivElement>;
  variant?: 'default' | 'glass' | 'outline' | 'premium';
  useDefault?: boolean;
}

export const variants = {
  default: 'border border-white/5 shadow-xl',
  glass: 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl',
  outline: 'bg-transparent border border-white/10 hover:border-primary-500/30',
  premium: 'border border-white/5 shadow-xl',
} as const;

export const defaultClasses = 'rounded-2xl overflow-hidden transition-all duration-300';

export const Card = ({
  children,
  className = '',
  variant = 'premium',
  useDefault = true,
  props: rootProps,
}: CardProps) => {
  const finalClassName = getSlotClass(useDefault, `${defaultClasses} ${variants[variant]}`, {
    className,
  });

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {children}
    </div>
  );
};

export interface CardSubComponentProps {
  children?: ReactNode;
  className?: string;
  props?: HTMLAttributes<HTMLDivElement>;
  useDefault?: boolean;
}

export const headerDefaultClasses = 'p-6 border-b border-white/5';

export const CardHeader = ({
  children,
  className = '',
  useDefault = true,
  props: rootProps,
}: CardSubComponentProps) => {
  const finalClassName = getSlotClass(useDefault, headerDefaultClasses, { className });

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {children}
    </div>
  );
};

export const titleDefaultClasses = 'text-2xl font-bold text-white';

export const CardTitle = ({
  children,
  className = '',
  useDefault = true,
  props: rootProps,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & {
  props?: HTMLAttributes<HTMLHeadingElement>;
  useDefault?: boolean;
}) => {
  const finalClassName = getSlotClass(useDefault, titleDefaultClasses, { className });

  return (
    <h3 {...rootProps} {...props} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {children}
    </h3>
  );
};

export const descriptionDefaultClasses = 'text-sm text-slate-400';

export const CardDescription = ({
  children,
  className = '',
  useDefault = true,
  props: rootProps,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & {
  props?: HTMLAttributes<HTMLParagraphElement>;
  useDefault?: boolean;
}) => {
  const finalClassName = getSlotClass(useDefault, descriptionDefaultClasses, { className });

  return (
    <p {...rootProps} {...props} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {children}
    </p>
  );
};

export const contentDefaultClasses = 'p-6';

export const CardContent = ({
  children,
  className = '',
  useDefault = true,
  props: rootProps,
}: CardSubComponentProps) => {
  const finalClassName = getSlotClass(useDefault, contentDefaultClasses, { className });

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {children}
    </div>
  );
};

export const footerDefaultClasses = 'p-6 bg-white/[0.02] border-t border-white/5';

export const CardFooter = ({
  children,
  className = '',
  useDefault = true,
  props: rootProps,
}: CardSubComponentProps) => {
  const finalClassName = getSlotClass(useDefault, footerDefaultClasses, { className });

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {children}
    </div>
  );
};
