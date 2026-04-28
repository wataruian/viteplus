import { errorBoundaryVariant } from './base';

const errorBoundaryStyles = {
  base: 'p-12 rounded-3xl flex flex-col items-center text-center backdrop-blur-sm',
  default: {
    intent: 'danger' as const,
  },
  variants: {
    intent: {
      danger: errorBoundaryVariant('danger', 'i-ph-warning-octagon-duotone'),
      warning: errorBoundaryVariant('warning', 'i-ph-warning-duotone'),
    },
  },
} as const;

export { errorBoundaryStyles };
