import type { Meta, StoryObj } from '@storybook/react';

import { ErrorBoundary } from './error-boundary';

const meta = {
  component: ErrorBoundary,
  tags: ['autodocs'],
  title: 'Design System/ErrorBoundary',
} satisfies Meta<typeof ErrorBoundary>;

const Default: StoryObj<typeof meta> = {
  args: {
    children: 'Content inside error boundary',
  },
};

export { Default };
export default meta;
