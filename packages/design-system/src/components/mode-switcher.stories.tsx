import type { Meta, StoryObj } from '@storybook/react';

import { ModeSwitcher } from './mode-switcher';

const meta = {
  component: ModeSwitcher,
  tags: ['autodocs'],
  title: 'Design System/ModeSwitcher',
} satisfies Meta<typeof ModeSwitcher>;

const Default: StoryObj<typeof meta> = {
  args: {},
};

export { Default };
export default meta;
