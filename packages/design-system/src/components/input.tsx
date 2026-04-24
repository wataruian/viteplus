import { type InputHTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { inputStyles } from '../tokens/styles';

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
export { Input };
