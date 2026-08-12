import { expect, test } from 'vite-plus/test';

import { getSample } from '../src/sample';

test('fn', () => {
  expect(getSample().message).toBe('Sample');
});
