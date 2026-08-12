import { expect, test } from 'vite-plus/test';

import { setupCounter } from '../src/counter';

test('fn', () => {
  expect(setupCounter).toBeInstanceOf(Function);
});
