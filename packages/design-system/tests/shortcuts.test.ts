import { describe, expect, test } from 'vite-plus/test';

import { shortcuts } from '../src/utils/shortcuts';

describe('shortcuts', () => {
  test('is an empty UnoCSS shortcuts object reserved for future use', () => {
    expect(shortcuts).toStrictEqual({});
  });
});
