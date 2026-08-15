import type { Meta, StoryObj } from '@storybook/react';

import { Typography } from './typography';

const meta = {
  argTypes: {
    as: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'],
    },
    type: {
      control: 'select',
      options: ['body', 'caption', 'display', 'headline', 'subHeadline'],
    },
  },
  component: Typography,
  tags: ['autodocs'],
  title: 'Design System/Typography',
} satisfies Meta<typeof Typography>;

const Default: StoryObj<typeof meta> = {
  args: {
    children: 'Typography Content',
    type: 'body',
  },
};

export { Default };
export default meta;
