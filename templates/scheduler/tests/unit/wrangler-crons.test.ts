import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'smol-toml';
import { describe, expect, test } from 'vite-plus/test';
import { z } from 'zod';

import { schedulesOf } from '../../src/core/script';
import { scripts } from '../../src/scripts';

const triggers = z.object({ crons: z.array(z.string()) }).optional();

const wranglerSchema = z.object({
  env: z.record(z.string(), z.object({ triggers })).default({}),
  triggers,
});

const wrangler = wranglerSchema.parse(
  parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../wrangler.toml'), 'utf8')),
);

const environments = ['develop', 'staging', 'production'];

describe('wrangler.toml cron triggers', () => {
  test.each(['(top level)', ...environments])(
    '%s fires exactly the schedules the scripts declare',
    (environment) => {
      const own =
        environment === '(top level)' ? wrangler.triggers : wrangler.env[environment]?.triggers;
      const crons = (own ?? wrangler.triggers)?.crons ?? [];

      expect(crons.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        schedulesOf(scripts),
      );
    },
  );

  test('declares every deploy environment', () => {
    expect(Object.keys(wrangler.env).toSorted()).toStrictEqual(environments.toSorted());
  });
});
