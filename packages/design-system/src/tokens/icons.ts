import type { IconifyJSON } from '@iconify/types';
import type { IconsOptions } from 'unocss/preset-icons';

const iconsOptions: IconsOptions = {
  collections: {
    ph: async () => {
      const i = (await import('@iconify-json/ph/icons.json')) as { default: IconifyJSON };
      return i.default;
    },
  },
  scale: 1.2,
  warn: true,
};

export { iconsOptions };
