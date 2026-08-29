import type { StorybookConfig } from '@storybook/react-vite';
import unocss from 'unocss/vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  addons: ['@storybook/addon-essentials'],
  core: {
    disableTelemetry: true,
  },
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  viteFinal: (c) =>
    mergeConfig(c, {
      build: {
        chunkSizeWarningLimit: 2500,
        rolldownOptions: {
          onwarn(warning: { code?: string }, warn: (w: unknown) => void) {
            if (warning.code === 'EVAL') {
              return;
            }
            warn(warning);
          },
        },
      },
      plugins: [unocss()],
    }),
};

export default config;
