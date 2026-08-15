import type { Meta, StoryObj } from '@storybook/react';

import { Preview } from './preview';

const meta = {
  component: Preview,
  tags: ['autodocs'],
  title: 'Design System/Preview',
} satisfies Meta<typeof Preview>;

const Default: StoryObj<typeof meta> = {
  args: {
    showDefault: true,
  },
};

export { Default };
export default meta;
