import type { Meta, StoryObj } from '@storybook/react';

import { Marquee } from './marquee';

const meta = {
  argTypes: {
    direction: {
      control: 'select',
      options: ['left', 'right'],
    },
    look: {
      control: 'select',
      options: ['default'],
    },
    pauseOnHover: {
      control: 'boolean',
      options: ['false', 'true'],
    },
    speed: {
      control: 'select',
      options: ['default', 'fast', 'slow'],
    },
  },
  component: Marquee,
  tags: ['autodocs'],
  title: 'Design System/Marquee',
} satisfies Meta<typeof Marquee>;

const Default: StoryObj<typeof meta> = {
  args: {
    children: <div className='p-4'>Marquee Item</div>,
  },
};

const Left: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    direction: 'left',
  },
};

const Right: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    direction: 'right',
  },
};

const False: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    pauseOnHover: false,
  },
};

const True: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    pauseOnHover: true,
  },
};

const Fast: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    speed: 'fast',
  },
};

const Slow: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    speed: 'slow',
  },
};

export { Default, Left, Right, False, True, Fast, Slow };
export default meta;
