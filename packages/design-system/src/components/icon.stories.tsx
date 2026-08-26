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

const Lg: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    size: 'lg',
  },
};

const Md: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    size: 'md',
  },
};

const Sm: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    size: 'sm',
  },
};

const Xl: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    size: 'xl',
  },
};

export { Default, Lg, Md, Sm, Xl };
export default meta;
