import { type CSSProperties, type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { combineClasses } from '../utils/helpers';
import { marqueeStyles } from '../tokens/styles';

const marqueeVariants = cva(marqueeStyles.base, {
  defaultVariants: marqueeStyles.default,
  variants: marqueeStyles.variants,
});

type MarqueeVariants = VariantProps<typeof marqueeVariants>;

interface MarqueeProps extends BaseComponentProps<HTMLAttributes<HTMLDivElement>>, MarqueeVariants {
  pauseOnHover?: boolean;
  speedValue?: number;
}

const Marquee = forwardRef<HTMLDivElement, MarqueeProps>(
  (
    {
      children,
      className = '',
      direction,
      pauseOnHover,
      props,
      speed,
      speedValue,
      useDefault = true,
    },
    ref,
  ) => {
    const finalClass = useDefault
      ? marqueeVariants({ className, direction, pauseOnHover, speed })
      : className;

    const duration =
      speedValue ?? Number(marqueeStyles.variants.speed[speed ?? marqueeStyles.default.speed]);

    const { look } = marqueeStyles.default;
    const lookStyles = marqueeStyles.variants.look[look];

    return (
      <div {...props} ref={ref} className={finalClass}>
        <div
          className={combineClasses(useDefault ? lookStyles.track : '')}
          style={
            { '--duration': `${duration}s` } as CSSProperties & Record<string, string | number>
          }
        >
          {children}
          {children}
        </div>
      </div>
    );
  },
);

Marquee.displayName = 'Marquee';

export type { MarqueeProps, MarqueeVariants };
export { Marquee };
