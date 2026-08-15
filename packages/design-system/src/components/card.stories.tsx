import type { Meta, StoryObj } from '@storybook/react';

import { Card } from './card';

const meta = {
  argTypes: {
    intent: {
      control: 'select',
      options: ['glass', 'outline', 'premium', 'primary'],
    },
  },
  component: Card,
  tags: ['autodocs'],
  title: 'Design System/Card',
} satisfies Meta<typeof Card>;

const Default: StoryObj<typeof meta> = {
  args: {
    children: 'Card Content',
    intent: 'primary',
  },
};

export { Default };
export default meta;
