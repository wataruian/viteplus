import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { getSlotClass } from '../utils/styles';

export interface InputProps {
  label?: string;
  error?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  useDefault?: boolean;
  props?: HTMLAttributes<HTMLDivElement>;
  labelProps?: HTMLAttributes<HTMLLabelElement>;
  wrapperProps?: HTMLAttributes<HTMLDivElement>;
  iconWrapperProps?: HTMLAttributes<HTMLDivElement>;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  errorProps?: HTMLAttributes<HTMLSpanElement>;
}

export const defaultInternalClasses = {
  error: 'text-xs text-red-500 px-1 mt-1 font-medium animate-fade-in',
  errorState: 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10',
  iconPadding: 'pl-11',
  iconWrapper:
    'absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors',
  input:
    'w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white transition-all duration-300 placeholder:text-slate-500 focus:outline-none focus:border-primary-500/50 focus:ring-4 focus:ring-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed hover:border-white/20 backdrop-blur-md',
  label:
    'text-sm font-medium text-slate-400 px-1 transition-colors group-focus-within:text-primary-400',
  wrapper: 'relative',
};

export const defaultClasses = 'flex flex-col gap-2';

export const Input = ({
  label,
  error,
  icon,
  className = '',
  useDefault = true,
  children,
  labelProps,
  wrapperProps,
  iconWrapperProps,
  inputProps,
  errorProps,
  props: rootProps,
}: InputProps) => {
  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <>
          {label !== undefined && label !== '' && (
            <label
              {...labelProps}
              className={getSlotClass(useDefault, defaultInternalClasses.label, labelProps)}
            >
              {label}
            </label>
          )}
          <div
            {...wrapperProps}
            className={getSlotClass(useDefault, defaultInternalClasses.wrapper, wrapperProps)}
          >
            {icon !== undefined && (
              <div
                {...iconWrapperProps}
                className={getSlotClass(
                  useDefault,
                  defaultInternalClasses.iconWrapper,
                  iconWrapperProps,
                )}
              >
                {icon}
              </div>
            )}
            <input
              {...inputProps}
              className={getSlotClass(
                useDefault,
                `${defaultInternalClasses.input} ${
                  icon === undefined ? '' : defaultInternalClasses.iconPadding
                } ${error === undefined || error === '' ? '' : defaultInternalClasses.errorState}`,
                inputProps,
              )}
            />
          </div>
          {error !== undefined && error !== '' && (
            <span
              {...errorProps}
              className={getSlotClass(useDefault, defaultInternalClasses.error, errorProps)}
            >
              {error}
            </span>
          )}
          {children}
        </>
      ) : (
        children
      )}
    </div>
  );
};
