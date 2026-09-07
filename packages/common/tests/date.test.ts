import { describe, expect, test } from 'vite-plus/test';

import { convertToLocalDate, formatDuration, formatTimestamp } from '../src/utils/date';

describe('formatTimestamp', () => {
  test('formats a timestamp as an ISO 8601 string', () => {
    expect(formatTimestamp(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(formatTimestamp(1_700_000_000_000)).toBe(new Date(1_700_000_000_000).toISOString());
  });
});

describe('convertToLocalDate', () => {
  test('formats a timestamp as YYYY-MM-DD hh:mm:ss.SSS AM/PM in local time', () => {
    const timestamp = new Date(2024, 0, 5, 13, 30, 45, 123).getTime();
    expect(convertToLocalDate(timestamp)).toBe('2024-01-05 01:30:45.123 PM');
  });

  test('formats midnight as 12 AM and noon as 12 PM', () => {
    expect(convertToLocalDate(new Date(2024, 5, 1, 0, 0, 0, 0).getTime())).toMatch(
      /^2024-06-01 12:00:00\.000 AM$/u,
    );
    expect(convertToLocalDate(new Date(2024, 5, 1, 12, 0, 0, 0).getTime())).toMatch(
      /^2024-06-01 12:00:00\.000 PM$/u,
    );
  });
});

describe('formatDuration', () => {
  test('formats zero as an empty string', () => {
    expect(formatDuration(0)).toBe('');
  });

  test('formats each unit only when non-zero', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(61_000)).toBe('1m 1s');
  });

  test('formats a duration spanning days, hours, minutes, seconds, and milliseconds', () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneHourMs = 60 * 60 * 1000;
    const oneMinuteMs = 60 * 1000;
    const duration = oneDayMs + 2 * oneHourMs + 3 * oneMinuteMs + 4000 + 5;
    expect(formatDuration(duration)).toBe('1d 2h 3m 4s 5ms');
  });
});
