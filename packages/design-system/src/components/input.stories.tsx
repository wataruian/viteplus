import type { Meta, StoryObj } from '@storybook/react';

import { Input } from './input';

const meta = {
  argTypes: {
    state: {
      control: 'select',
      options: ['default', 'error', 'success'],
    },
  },
  component: Input,
  tags: ['autodocs'],
  title: 'Design System/Input',
} satisfies Meta<typeof Input>;

const Default: StoryObj<typeof meta> = {
  args: {
    props: {
      placeholder: 'Enter text...',
    },
    state: 'default',
  },
};

const ErrorState: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    state: 'error',
  },
};

const Success: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    state: 'success',
  },
};

export { Default, ErrorState, Success };
export default meta;
