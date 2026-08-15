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

export { Default };
export default meta;
