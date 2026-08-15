import type { Meta, StoryObj } from '@storybook/react';

import { Header } from './header';

const meta = {
  component: Header,
  tags: ['autodocs'],
  title: 'Design System/Header',
} satisfies Meta<typeof Header>;

const Default: StoryObj<typeof meta> = {
  args: {
    showLogo: true,
    showModeSwitcher: true,
    showThemeSwitcher: true,
  },
};

export { Default };
export default meta;
