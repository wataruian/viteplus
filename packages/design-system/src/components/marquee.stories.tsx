import type { Meta, StoryObj } from '@storybook/react';

import { Marquee } from './marquee';

const meta = {
  component: Marquee,
  tags: ['autodocs'],
  title: 'Design System/Marquee',
} satisfies Meta<typeof Marquee>;

const Default: StoryObj<typeof meta> = {
  args: {
    children: <div className='p-4'>Marquee Item</div>,
  },
};

export { Default };
export default meta;
