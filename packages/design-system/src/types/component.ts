import type { ReactNode } from 'react';

interface BaseComponentProps<TKey = Record<string, unknown>> {
  children?: ReactNode;
  className?: string;
  props?: TKey;
  useDefault?: boolean;
}

export type { BaseComponentProps };
