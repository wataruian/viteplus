import { DocsContainer } from '@storybook/blocks';

import 'virtual:uno.css';

import type { Preview } from '@storybook/react';
import { themes } from '@storybook/theming';
import type { ComponentProps } from 'react';

import type { Mode } from '../src/context/mode-context';
import { ModeProvider } from '../src/context/mode-provider';
import { ThemeProvider } from '../src/context/theme-provider';

const hasStore = (
  obj: unknown,
): obj is { store: { userGlobals?: { globals?: { theme?: string } } } } =>
  typeof obj === 'object' && obj !== null && 'store' in obj;

const CustomDocsContainer = (props: ComponentProps<typeof DocsContainer>) => {
  const ctx: unknown = props.context;
  const isDark = hasStore(ctx) ? ctx.store.userGlobals?.globals?.theme === 'dark' : true;

  return (
    <div className={isDark ? 'dark' : 'light'}>
      <DocsContainer {...props} theme={isDark ? themes.dark : themes.normal} />
    </div>
  );
};

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const themeVal: unknown = context.globals['theme'];
      const mode: Mode = themeVal === 'light' || themeVal === 'dark' ? themeVal : 'dark';
      return (
        <ThemeProvider>
          <ModeProvider initialMode={mode}>
            <div className='p-4 bg-adaptive text-adaptive min-h-screen'>
              <Story />
            </div>
          </ModeProvider>
        </ThemeProvider>
      );
    },
  ],
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      name: 'Theme',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { icon: 'sun', title: 'Light Mode', value: 'light' },
          { icon: 'moon', title: 'Dark Mode', value: 'dark' },
        ],
        showName: true,
      },
    },
  },
  initialGlobals: {
    theme: 'dark',
  },
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
  },
};

export default preview;
