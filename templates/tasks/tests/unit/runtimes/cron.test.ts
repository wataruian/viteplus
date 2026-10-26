import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vite-plus/test';

import { cronTickMs } from '../../../src/core/retention';

const wranglerToml = fs.readFileSync(
  path.resolve(import.meta.dirname, '../../../wrangler.toml'),
  'utf8',
);

describe('cron tick', () => {
  test('matches every cron trigger in wrangler.toml (isPurgeDue relies on it)', () => {
    const crons = [...wranglerToml.matchAll(/^\s*crons\s*=\s*(?<value>\[.*\])\s*$/gmu)].map(
      (match) => match.groups?.['value'],
    );

    expect(crons.length).toBeGreaterThan(0);
    expect(new Set(crons)).toStrictEqual(new Set(['["* * * * *"]']));
    expect(cronTickMs).toBe(60_000);
  });
});
