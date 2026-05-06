import { Component, type ErrorInfo, type ReactNode, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { Card } from './card';
import { Icon } from './icon';
import { Typography } from './typography';
import { baseStyles } from '../tokens/base';

const errorBoundaryStyles = {
  base: 'p-12 rounded-3xl flex flex-col items-center text-center backdrop-blur-sm',
  default: {
    intent: 'danger' as const,
  },
  variants: {
    intent: {
      danger: {
        base: `${baseStyles.colors.bg.danger}/10`,
        container: 'flex flex-col items-center gap-6',
        content: 'space-y-2',
        description: `${baseStyles.colors.text.inverseSurface}/60 text-lg leading-relaxed max-w-lg`,
        icon: `i-ph-warning-octagon-duotone text-6xl ${baseStyles.colors.text.danger}/80`,
        title: `${baseStyles.colors.text.danger} font-black text-3xl tracking-tight`,
      },
      warning: {
        base: `${baseStyles.colors.bg.warning}/10`,
        container: 'flex flex-col items-center gap-6',
        content: 'space-y-2',
        description: `${baseStyles.colors.text.inverseSurface}/60 text-lg leading-relaxed max-w-lg`,
        icon: `i-ph-warning-duotone text-6xl ${baseStyles.colors.text.warning}/80`,
        title: `${baseStyles.colors.text.warning} font-black text-3xl tracking-tight`,
      },
    },
  },
} as const;

const errorBoundaryVariants = cva(errorBoundaryStyles.base, {
  defaultVariants: errorBoundaryStyles.default,
  variants: {
    intent: {
      danger: errorBoundaryStyles.variants.intent.danger.base,
      warning: errorBoundaryStyles.variants.intent.warning.base,
    },
  },
});

type ErrorBoundaryVariants = VariantProps<typeof errorBoundaryVariants>;

interface ErrorBoundaryProps extends BaseComponentProps, ErrorBoundaryVariants {
  description?: ReactNode;
  fallback?: ReactNode;
  slots?: {
    container?: string;
    content?: string;
    description?: string;
    icon?: string;
    title?: string;
  };
  title?: ReactNode;
  forceError?: boolean;
}

interface ErrorBoundaryState {
  error?: Error | undefined;
  hasError: boolean;
}

class ErrorBoundaryBase extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
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

  private renderError(): ReactNode {
    const {
      className = '',
      description = 'Something went wrong while rendering this component. Our team has been notified.',
      props,
      slots,
      title = 'Component Error',
      useDefault = true,
    } = this.props;

    const intent = this.props.intent ?? errorBoundaryStyles.default.intent;
    const intentStyles = errorBoundaryStyles.variants.intent[intent];
    const finalClass = useDefault ? errorBoundaryVariants({ className, intent }) : className;

    return (
      <Card {...props} className={finalClass}>
        {useDefault ? (
          <div className={slots?.container ?? intentStyles.container}>
            <Icon name={slots?.icon ?? intentStyles.icon} />
            <div className={slots?.content ?? intentStyles.content}>
              <Typography as='h2' className={slots?.title ?? intentStyles.title}>
                {title}
              </Typography>
              <Typography type='body' className={slots?.description ?? intentStyles.description}>
                {description}
              </Typography>
            </div>
          </div>
        ) : null}
      </Card>
    );
  }

  public override render(): ReactNode {
    const { children, fallback, forceError } = this.props;

    if (this.state.hasError || forceError === true) {
      if (fallback !== undefined && fallback !== null && forceError !== true) {
        return fallback;
      }

      return this.renderError();
    }

    return children;
  }
}

const ErrorBoundary = forwardRef<ErrorBoundaryBase, ErrorBoundaryProps>((props, ref) => (
  <ErrorBoundaryBase {...props} ref={ref} />
));

ErrorBoundary.displayName = 'ErrorBoundary';

export type { ErrorBoundaryProps, ErrorBoundaryState, ErrorBoundaryVariants };
export { ErrorBoundary, ErrorBoundaryBase, errorBoundaryStyles };
