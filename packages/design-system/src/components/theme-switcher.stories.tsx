import type { Meta, StoryObj } from '@storybook/react';

import { ThemeSwitcher } from './theme-switcher';

const meta = {
  argTypes: {
    look: {
      control: 'select',
      options: ['default'],
    },
    plain: {
      control: 'boolean',
      options: ['false', 'true'],
    },
  },
  component: ThemeSwitcher,
  tags: ['autodocs'],
  title: 'Design System/ThemeSwitcher',
} satisfies Meta<typeof ThemeSwitcher>;

const Default: StoryObj<typeof meta> = {
  args: {
    plain: false,
  },
};

const False: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    plain: false,
  },
};

const True: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    plain: true,
  },
};

export { Default, False, True };
export default meta;
