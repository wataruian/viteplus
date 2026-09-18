import type * as DaggerModule from '@dagger.io/dagger';
import { vi } from 'vite-plus/test';

import { createFakeDag } from './dagger-fakes';
import { world } from './dagger-world';

vi.mock('@dagger.io/dagger', async (importOriginal) => {
  const actual = await importOriginal<typeof DaggerModule>();
  return { ...actual, dag: createFakeDag(world) };
});
