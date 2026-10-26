import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vite-plus/test';

const migrationsDir = path.resolve(import.meta.dirname, '../../migrations');

describe('migration folders', () => {
  test.each(['postgres', 'd1'])(
    '%s: every migration has migration.sql and snapshot.json',
    (dialect) => {
      const incomplete = fs
        .readdirSync(path.join(migrationsDir, dialect), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter(({ name }) =>
          ['migration.sql', 'snapshot.json'].some(
            (file) => !fs.existsSync(path.join(migrationsDir, dialect, name, file)),
          ),
        )
        .map(({ name }) => `migrations/${dialect}/${name}`);

      expect(incomplete, 'delete these incomplete migration folders').toStrictEqual([]);
    },
  );
});
