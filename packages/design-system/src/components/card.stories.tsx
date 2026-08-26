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

const Glass: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'glass',
  },
};

const Outline: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'outline',
  },
};

const Premium: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'premium',
  },
};

const Primary: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'primary',
  },
};

export { Default, Glass, Outline, Premium, Primary };
export default meta;
