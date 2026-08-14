import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './button';

const meta = {
  argTypes: {
    intent: {
      control: 'select',
      options: [
        'accent',
        'danger',
        'ghost',
        'info',
        'inverse',
        'premium',
        'primary',
        'secondary',
        'success',
        'warning',
      ],
    },
    size: {
      control: 'select',
      options: ['lg', 'md', 'sm', 'xl'],
    },
  },
  component: Button,
  tags: ['autodocs'],
  title: 'Design System/Button',
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: 'Primary Button',
    intent: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary Button',
    intent: 'secondary',
  },
};
