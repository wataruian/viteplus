import type { HTMLAttributes, ReactNode } from 'react';

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export const BentoGrid = ({ children, className = '' }: BentoGridProps) => (
  <div className={`bento-grid ${className}`}>{children}</div>
);

interface BentoItemProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon?: string;
  children?: ReactNode;
  span?: string;
}

export const BentoItem = ({
  title,
  description,
  icon,
  children,
  className = '',
  span = 'col-span-1',
  ...props
}: BentoItemProps) => (
  <div className={`bento-item ${span} ${className}`} {...props}>
    <div className='p-8 flex flex-col h-full'>
      {Boolean(icon) && (
        <div className='w-14 h-14 glass-border mb-8 text-primary-400 group-hover:scale-110 transition-transform duration-500'>
          <div className={`${icon ?? ''} text-2xl`} />
        </div>
      )}

      <h3 className='text-3xl font-black text-white mb-4 tracking-tight font-header transition-all duration-300 group-hover:text-primary-300'>
        {title}
      </h3>
      <p className='text-lg text-slate-400 leading-relaxed font-medium'>{description}</p>
      {Boolean(children) && <div className='mt-auto pt-8'>{children}</div>}
    </div>

    <div className='absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none' />
    <div className='absolute -bottom-10 -right-10 w-40 h-40 bg-primary-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none' />
  </div>
);
