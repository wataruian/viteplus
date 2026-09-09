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

const Default: StoryObj<typeof meta> = {
  args: {
    children: 'Button',
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

const Ghost: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'ghost',
  },
};

const Info: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'info',
  },
};

const Inverse: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'inverse',
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

const Secondary: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    intent: 'secondary',
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

const Xl: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    size: 'xl',
  },
};

export {
  Accent,
  Danger,
  Default,
  Ghost,
  Info,
  Inverse,
  Lg,
  Md,
  Premium,
  Primary,
  Secondary,
  Sm,
  Success,
  Warning,
  Xl,
};
export default meta;
