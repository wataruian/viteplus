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

const Primary: StoryObj<typeof meta> = {
  args: {
    children: 'Primary Button',
    intent: 'primary',
  },
};

const Secondary: StoryObj<typeof meta> = {
  args: {
    children: 'Secondary Button',
    intent: 'secondary',
  },
};

export { Primary, Secondary };
export default meta;
