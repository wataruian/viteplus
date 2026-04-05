import { expect, test } from 'vite-plus/test';
import { samples } from '../src/index.ts';

test('fn', () => {
  expect(samples.hello.greet()).toBe('Hello World!');
});
