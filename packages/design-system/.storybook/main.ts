import type { StorybookConfig } from '@storybook/react-vite';
import unocss from 'unocss/vite';
import { mergeConfig } from 'vite';

import { devServerWatchIgnored } from '../../../vite.config.ts';

const config: StorybookConfig = {
  addons: ['@storybook/addon-docs'],
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
        chunkSizeWarningLimit: 1500,
      },
      plugins: [unocss()],
      server: { watch: { ignored: devServerWatchIgnored } },
    }),
};

export default config;
