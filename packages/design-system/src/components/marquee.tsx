import type { CSSProperties, HTMLAttributes } from 'react';
import { cn, getSlotClass } from '../utils/styles';
import type { BaseComponentProps } from '../types/component';
import { featureStyles } from '../tokens/variants';

interface MarqueeProps extends BaseComponentProps<HTMLAttributes<HTMLDivElement>> {
  direction?: 'left' | 'right';
  pauseOnHover?: boolean;
  speed?: number;
}

const Marquee = ({
  children,
  className = '',
  direction = 'left',
  pauseOnHover = true,
  props,
  speed = 40,
  useDefault = true,
}: MarqueeProps) => {
  const finalClass = useDefault ? `${featureStyles.marquee.root} ${className}` : className;

  const animationClass =
    direction === 'left' ? featureStyles.marquee.animLeft : featureStyles.marquee.animRight;

  return (
    <div {...props} className={getSlotClass(useDefault, finalClass, props)}>
      <div
        className={cn(
          useDefault ? featureStyles.marquee.track : '',
          animationClass,
          pauseOnHover && featureStyles.marquee.trackPause,
        )}
        style={{ '--duration': `${speed}s` } as CSSProperties & Record<string, string | number>}
      >
        {children}
        {children}
      </div>
    </div>
  );
};

export type { MarqueeProps };
export { Marquee };
