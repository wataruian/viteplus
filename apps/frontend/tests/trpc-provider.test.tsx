import { describe, expect, test } from 'vite-plus/test';

import { trpcClient } from '../src/providers/trpc-provider';

describe('trpcClient', () => {
  test('is created with a callable test.hello query procedure', () => {
    expect(typeof trpcClient.test.hello.query).toBe('function');
  });
});
