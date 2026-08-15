import type { Meta, StoryObj } from '@storybook/react';

import { Container, Section } from './layout';

const meta = {
  tags: ['autodocs'],
  title: 'Design System/Layout',
} satisfies Meta;

const ContainerStory: StoryObj<typeof Container> = {
  args: {
    children: 'Container Content',
  },
  render: (args) => <Container {...args} />,
};

const SectionStory: StoryObj<typeof Section> = {
  args: {
    children: 'Section Content',
  },
  render: (args) => <Section {...args} />,
};

export { ContainerStory as Container, SectionStory as Section };
export default meta;
