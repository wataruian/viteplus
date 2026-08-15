import type { Meta, StoryObj } from '@storybook/react';

import { ThemeSwitcher } from './theme-switcher';

const meta = {
  component: ThemeSwitcher,
  tags: ['autodocs'],
  title: 'Design System/ThemeSwitcher',
} satisfies Meta<typeof ThemeSwitcher>;

const Default: StoryObj<typeof meta> = {
  args: {
    plain: false,
  },
};

export { Default };
export default meta;
