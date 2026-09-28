import type { Preview } from '@storybook/react-vite';

import 'virtual:uno.css';

import { CustomDocsContainer, ModeFrame } from './mode';

const preview: Preview = {
  decorators: [
    (Story) => (
      <ModeFrame>
        <Story />
      </ModeFrame>
    ),
  ],
  parameters: {
    backgrounds: {
      disable: true,
    },
    controls: {
      matchers: {
        color: /(?<color>background|color)$/iu,
        date: /Date$/iu,
      },
    },
    docs: {
      container: CustomDocsContainer,
    },
    layout: 'fullscreen',
  },
};

export default preview;
