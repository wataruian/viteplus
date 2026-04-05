import { expect, test } from 'vite-plus/test';

const expectValue = 1;

test('fn', () => {
  expect(expectValue).toBe(expectValue);
});
