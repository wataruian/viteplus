import type { Meta, StoryObj } from '@storybook/react';

import { Logo } from './logo';

const meta = {
  argTypes: {
    look: {
      control: 'select',
      options: ['default'],
    },
  },
  component: Logo,
  tags: ['autodocs'],
  title: 'Design System/Logo',
} satisfies Meta<typeof Logo>;

const Default: StoryObj<typeof meta> = {
  args: {
    textBottom: 'PROJECT',
    textTop: 'LIGHT',
  },
};

export { Default };
export default meta;
