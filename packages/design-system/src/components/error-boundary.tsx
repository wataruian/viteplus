import { Component, type ErrorInfo, type ReactNode, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { Card } from './card';
import { Icon } from './icon';
import { Typography } from './typography';
import { errorBoundaryStyles } from '../tokens/styles';

const errorBoundaryVariants = cva(errorBoundaryStyles.base, {
  defaultVariants: errorBoundaryStyles.default,
  variants: errorBoundaryStyles.variants,
});

type ErrorBoundaryVariants = VariantProps<typeof errorBoundaryVariants>;

interface ErrorBoundaryProps extends ErrorBoundaryVariants {
  children?: ReactNode;
  className?: string;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error?: Error | undefined;
  hasError: boolean;
}

class ErrorBoundaryBase extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      error: undefined,
      hasError: false,
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, hasError: true };
  }

  public static componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    globalThis.console.error('An error occurred in the component', error, errorInfo);
  }

  public override render(): ReactNode {
    const { children, className, fallback } = this.props;

    if (this.state.hasError) {
      if (fallback !== undefined && fallback !== null) {
        return fallback;
      }

      return (
        <Card className={errorBoundaryVariants({ className })}>
          <div className={errorBoundaryStyles.slots.container}>
            <Icon name={errorBoundaryStyles.slots.icon} />
            <div className={errorBoundaryStyles.slots.content}>
              <Typography as='h2' className={errorBoundaryStyles.slots.title}>
                Component Error
              </Typography>
              <Typography type='body' className={errorBoundaryStyles.slots.description}>
                Something went wrong while rendering this component. Our team has been notified.
              </Typography>
            </div>
          </div>
        </Card>
      );
    }

    return children;
  }
}

const ErrorBoundary = forwardRef<ErrorBoundaryBase, ErrorBoundaryProps>((props, ref) => (
  <ErrorBoundaryBase {...props} ref={ref} />
));

ErrorBoundary.displayName = 'ErrorBoundary';

export type { ErrorBoundaryProps, ErrorBoundaryState, ErrorBoundaryVariants };
export { ErrorBoundary, ErrorBoundaryBase };
