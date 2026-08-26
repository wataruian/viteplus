import type { Meta, StoryObj } from '@storybook/react';

import { Header } from './header';

const meta = {
  argTypes: {
    look: {
      control: 'select',
      options: ['default'],
    },
  },
  component: Header,
  tags: ['autodocs'],
  title: 'Design System/Header',
} satisfies Meta<typeof Header>;

const Default: StoryObj<typeof meta> = {
  args: {
    children: <span className='font-semibold text-lg'>Custom Header Text</span>,
    showLogo: false,
    showModeSwitcher: false,
    showThemeSwitcher: false,
  },
};

export { Default };
export default meta;
