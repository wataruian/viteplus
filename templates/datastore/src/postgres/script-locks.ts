import { and, eq, lte, sql } from 'drizzle-orm';

import type { ScriptLockStore } from '../repositories/types';
import type { AnyPostgresDatabase } from './client';
import { dbTime } from './clock';
import { scriptLocks } from './schema';

const createPostgresScriptLockStore = (db: AnyPostgresDatabase): ScriptLockStore => ({
  acquire: async ({ leaseMs, name, now, owner }) => {
    const rows = await db
      .insert(scriptLocks)
      .values({
        createdAt: dbTime(now),
        expiresAt: dbTime(now, leaseMs),
        name,
        owner,
        updatedAt: dbTime(now),
      })
      .onConflictDoUpdate({
        set: {
          createdAt: sql.raw('excluded.created_at'),
          expiresAt: sql.raw('excluded.expires_at'),
          owner: sql.raw('excluded.owner'),
          updatedAt: sql.raw('excluded.updated_at'),
        },
        setWhere: lte(scriptLocks.expiresAt, dbTime(now)),
        target: scriptLocks.name,
      })
      .returning({ name: scriptLocks.name });
    return rows.length > 0;
  },
  release: async ({ name, owner }) => {
    const rows = await db
      .delete(scriptLocks)
      .where(and(eq(scriptLocks.name, name), eq(scriptLocks.owner, owner)))
      .returning({ name: scriptLocks.name });
    return rows.length > 0;
  },
  renew: async ({ leaseMs, name, now, owner }) => {
    const rows = await db
      .update(scriptLocks)
      .set({ expiresAt: dbTime(now, leaseMs), updatedAt: dbTime(now) })
      .where(and(eq(scriptLocks.name, name), eq(scriptLocks.owner, owner)))
      .returning({ name: scriptLocks.name });
    return rows.length > 0;
  },
});

export { createPostgresScriptLockStore };
