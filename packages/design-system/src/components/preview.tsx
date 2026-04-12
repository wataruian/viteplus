import type { BaseComponentProps } from '../types/component';
import type { HTMLAttributes } from 'react';

type PreviewProps = BaseComponentProps<HTMLAttributes<HTMLDivElement>>;

const Preview = () => <div>Hello World!</div>;

export type { PreviewProps };
export { Preview };
