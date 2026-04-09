import type { ReactNode } from 'react';

/**
 * Common props shared by most design system components.
 * TKey is a generic for the specific element props (e.g., HTMLAttributes<HTMLDivElement>).
 */
interface BaseComponentProps<TKey = Record<string, unknown>> {
  children?: ReactNode;
  className?: string;
  props?: TKey;
  useDefault?: boolean;
}

export type { BaseComponentProps };
