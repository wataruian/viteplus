import { describe, expect, test } from 'vite-plus/test';

import { checkSchedule } from '../../../src/core/schedule';

describe('checkSchedule', () => {
  test.each([
    '* * * * *',
    '*/5 * * * *',
    '0 3 * * *',
    '0,30 8-18 * * *',
    '15 2 1 */3 *',
    '0 9 * * MON-FRI',
    '0 9 * * SUN,SAT',
    '0 0-12/2 * * *',
  ])('accepts %s', (expression) => {
    expect(checkSchedule(expression)).toBeUndefined();
  });

  test.each([
    ['* * * *', /5 space-separated fields/u],
    ['* * * * * *', /5 space-separated fields/u],
    ['*  * * * *', /5 space-separated fields/u],
    ['@daily', /5 space-separated fields/u],
    ['60 * * * *', /minute/u],
    ['* 24 * * *', /hour/u],
    ['* * 0 * *', /day of month/u],
    ['* * * 13 *', /month/u],
    ['* * * JAN *', /month/u],
    ['* * * * 1', /names only/u],
    ['* * * * MON#2', /names only/u],
    ['* * L * *', /day of month/u],
    ['* * ? * *', /day of month/u],
    ['30-10 * * * *', /minute/u],
    ['*/0 * * * *', /minute/u],
    ['5/15 * * * *', /step only after \* or a range/u],
    ['0 9 * * MON/2', /names only/u],
    ['0 0 1 * MON', /not both/u],
  ])('rejects %s', (expression, reason) => {
    expect(checkSchedule(expression)).toMatch(reason);
  });
});
