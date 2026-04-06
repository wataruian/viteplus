import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = ({ label, error, icon, className = '', ...props }: InputProps) => {
  const baseInputStyles =
    'w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white transition-all duration-300 placeholder:text-slate-500 focus:outline-none focus:border-primary-500/50 focus:ring-4 focus:ring-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed hover:border-white/20 backdrop-blur-md';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label !== undefined && label !== '' && (
        <label className='text-sm font-medium text-slate-400 px-1 transition-colors group-focus-within:text-primary-400'>
          {label}
        </label>
      )}
      <div className='relative group'>
        {icon !== undefined && (
          <div className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors'>
            {icon}
          </div>
        )}
        <input
          className={`${baseInputStyles} ${icon === undefined ? '' : 'pl-11'} ${error === undefined || error === '' ? '' : 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10'}`}
          {...props}
        />
      </div>
      {error !== undefined && error !== '' && (
        <span className='text-xs text-red-500 px-1 mt-1 font-medium animate-fade-in'>{error}</span>
      )}
    </div>
  );
};
