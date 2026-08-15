import type { Meta, StoryObj } from '@storybook/react';

import { Badge } from './badge';

const meta = {
  argTypes: {
    intent: {
      control: 'select',
      options: ['accent', 'danger', 'glass', 'info', 'outline', 'primary', 'success', 'warning'],
    },
    size: {
      control: 'select',
      options: ['lg', 'md', 'sm'],
    },
  },
  component: Badge,
  tags: ['autodocs'],
  title: 'Design System/Badge',
} satisfies Meta<typeof Badge>;

const Default: StoryObj<typeof meta> = {
  args: {
    children: 'Badge',
    intent: 'primary',
  },
};

export { Default };
export default meta;
