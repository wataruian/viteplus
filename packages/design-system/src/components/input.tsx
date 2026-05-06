import { type InputHTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { baseStyles, intentInput } from '../tokens/base';
import type { BaseComponentProps } from '../types/component';

const inputStyles = {
  base: `w-full max-w-full box-border min-w-0 ${baseStyles.colors.bg.adaptiveSurface}/50 rounded-xl px-4 py-3 ${baseStyles.colors.text.inverseSurface} placeholder:${baseStyles.colors.text.inverseSurface}/40 transition-all focus:outline-none focus:ring-2 shadow-sm`,
  default: {
    state: 'default' as const,
  },
  variants: {
    state: {
      default: '',
      error: intentInput('danger'),
      success: intentInput('success'),
    },
  },
} as const;

const inputVariants = cva(inputStyles.base, {
  defaultVariants: inputStyles.default,
  variants: inputStyles.variants,
});

type InputVariants = VariantProps<typeof inputVariants>;

interface InputProps
  extends BaseComponentProps<InputHTMLAttributes<HTMLInputElement>>, InputVariants {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', props, state, useDefault = true }, ref) => {
    const finalClass = useDefault ? inputVariants({ className, state }) : className;

    return <input {...props} ref={ref} className={finalClass} />;
  },
);

Input.displayName = 'Input';

export type { InputProps, InputVariants };
export { Input, inputStyles };
