import { expect, test } from 'vite-plus/test';

import { greet } from '../src/samples/hello';

test('fn', () => {
  expect(greet()).toBe('Hello World!');
});
