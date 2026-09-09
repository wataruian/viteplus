import type { Meta, StoryObj } from '@storybook/react';

import { ErrorBoundary } from './error-boundary';

const meta = {
  argTypes: {
    intent: {
      control: 'select',
      options: ['danger', 'warning'],
    },
  },
  component: ErrorBoundary,
  tags: ['autodocs'],
  title: 'Design System/ErrorBoundary',
} satisfies Meta<typeof ErrorBoundary>;

const Default: StoryObj<typeof meta> = {
  args: {
    children: 'Content inside error boundary',
  },
};

const Danger: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    forceError: true,
    intent: 'danger',
  },
};

const Warning: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    forceError: true,
    intent: 'warning',
  },
};

export { Danger, Default, Warning };
export default meta;
