import type { Meta, StoryObj } from '@storybook/react';

import { Icon } from './icon';

const meta = {
  argTypes: {
    size: {
      control: 'select',
      options: ['lg', 'md', 'sm', 'xl'],
    },
  },
  component: Icon,
  tags: ['autodocs'],
  title: 'Design System/Icon',
} satisfies Meta<typeof Icon>;

const Default: StoryObj<typeof meta> = {
  args: {
    name: 'i-ph-star-fill',
    size: 'md',
  },
};

export { Default };
export default meta;
