import type { Preview } from '@storybook/react';

import 'virtual:uno.css';

import { ModeProvider } from '../src/context/mode-provider';
import { ThemeProvider } from '../src/context/theme-provider';

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <ModeProvider>
          <div className='p-4 bg-adaptive text-adaptive min-h-screen'>
            <Story />
          </div>
        </ModeProvider>
      </ThemeProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(?<color>background|color)$/iu,
        date: /Date$/iu,
      },
    },
  },
};

export default preview;
