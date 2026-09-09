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

const Accent: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'accent',
  },
};

const Danger: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'danger',
  },
};

const Glass: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'glass',
  },
};

const Info: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'info',
  },
};

const Outline: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'outline',
  },
};

const Primary: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'primary',
  },
};

const Success: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'success',
  },
};

const Warning: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'warning',
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

export { Accent, Danger, Default, Glass, Info, Lg, Md, Outline, Primary, Sm, Success, Warning };
export default meta;
