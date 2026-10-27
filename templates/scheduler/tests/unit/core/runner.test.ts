import { logger } from '@lightproject/common/logger';
import { context as otelContext } from '@lightproject/common/utils';
import type { repositories, types } from '@lightproject/datastore';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

import {
  type RunOptions,
  ScriptAbortedError,
  abandonOnAbort,
  attempt,
  checkLease,
  defaultAbortGraceMs,
  defaultLease,
  leaseMarginMs,
  renewAfterSlowAcquire,
  reserveFor,
  runScript,
} from '../../../src/core/runner';
import {
  InvalidInputError,
  type Script,
  type ScriptContext,
  defineScript,
  noInput,
} from '../../../src/core/script';
import { useLocalDatabase } from '../helpers/database';

afterEach(() => {
  vi.restoreAllMocks();
});

const { openDatabase } = useLocalDatabase();

const lockScope = '@lightproject/test';

const options = (overrides: Partial<RunOptions> = {}): RunOptions => ({
  input: {},
  lockScope,
  openDatabase,
  trigger: 'manual',
  ...overrides,
});

const untilAborted = async ({ signal }: ScriptContext) => {
  await new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => {
      resolve();
    });
  });
};

const lockOf = async (script: Script) => {
  const database = await openDatabase();
  return await database.scriptLocks.findByName(`${lockScope}/${script.name}`);
};

const succeeds = async () => {
  await Promise.resolve();
};

const losingDatabase =
  (renew: () => Promise<boolean>) => async (): Promise<repositories.Database> => {
    const database = await openDatabase();
    return { ...database, scriptLocks: { ...database.scriptLocks, renew } };
  };

const takenOver = async (): Promise<boolean> => await Promise.resolve(false);

const unreachable = async (): Promise<boolean> => {
  await Promise.resolve();
  throw new Error('database unreachable');
};

const acquireReplyLostDatabase = async (): Promise<repositories.Database> => {
  const database = await openDatabase();
  return {
    ...database,
    scriptLocks: {
      ...database.scriptLocks,
      acquire: async (lock) => {
        await database.scriptLocks.acquire(lock);
        throw new Error('connection closed before the reply');
      },
    },
  };
};

const hangingReleaseDatabase = async (): Promise<repositories.Database> => {
  const database = await openDatabase();
  return {
    ...database,
    scriptLocks: {
      ...database.scriptLocks,
      release: async () => await new Promise<boolean>(() => {}),
    },
  };
};

describe('runScript', () => {
  test('succeeds, passes the context and frees the lock', async () => {
    const seen: ScriptContext[] = [];
    const held: (types.ScriptLock | undefined)[] = [];
    const script = defineScript({
      input: noInput,
      name: 'ok',
      run: async (_input, context) => {
        seen.push(context);
        held.push(await lockOf(script));
        await expect(
          context.db.users.findById('00000000-0000-4000-8000-000000000000'),
        ).resolves.toBeUndefined();
      },
    });
    const scheduledTime = new Date(60_000);

    const result = await runScript(script, options({ scheduledTime, trigger: 'schedule' }));

    expect(result.outcome).toBe('succeeded');
    expect(result.error).toBeUndefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(seen[0]).toMatchObject({ scheduledTime, trigger: 'schedule' });
    expect(held[0]).toMatchObject({ name: `${lockScope}/ok` });
    expect(await lockOf(script)).toBeUndefined();
  });

  test('skips a run while another one holds the lock, then runs once it is free', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const { promise: release, resolve } = Promise.withResolvers<boolean>();
    const { promise: holding, resolve: held } = Promise.withResolvers<boolean>();
    const runs = vi.fn(async () => {
      held(true);
      await release;
    });
    const script = defineScript({ input: noInput, name: 'exclusive', run: runs });

    const first = runScript(script, options({ trigger: 'schedule' }));
    await holding;
    const overlapping = await runScript(script, options());
    resolve(true);

    expect(overlapping.outcome).toBe('skipped');
    expect(warn).toHaveBeenCalledWith(
      'Script exclusive skipped: a previous run still holds its lock',
      expect.objectContaining({ trigger: 'manual' }),
    );
    const firstResult = await first;
    expect(firstResult.outcome).toBe('succeeded');
    expect(runs).toHaveBeenCalledOnce();

    runs.mockImplementation(succeeds);
    const afterwards = await runScript(script, options());
    expect(afterwards.outcome).toBe('succeeded');
    expect(runs).toHaveBeenCalledTimes(2);
  });

  test('scopes the lock, so another app may run a script of the same name', async () => {
    const { promise: release, resolve } = Promise.withResolvers<boolean>();
    const { promise: holding, resolve: held } = Promise.withResolvers<boolean>();
    const script = defineScript({
      input: noInput,
      name: 'shared-name',
      run: async (_input, { trigger }) => {
        if (trigger === 'schedule') {
          held(true);
          await release;
        }
      },
    });

    const first = runScript(script, options({ trigger: 'schedule' }));
    await holding;
    const other = await runScript(script, options({ lockScope: '@lightproject/other' }));
    resolve(true);

    const firstResult = await first;
    expect(other.outcome).toBe('succeeded');
    expect(firstResult.outcome).toBe('succeeded');
  });

  test('the default lease rides out one failed renewal and aborts in time after two', () => {
    const { leaseMs, renewEveryMs } = defaultLease;
    const reserveMs = reserveFor(defaultLease, defaultAbortGraceMs);

    expect(2 * renewEveryMs + reserveMs).toBeLessThan(leaseMs);
    expect(3 * renewEveryMs + reserveMs).toBeGreaterThanOrEqual(leaseMs);
    expect(leaseMs - 3 * renewEveryMs).toBeGreaterThanOrEqual(defaultAbortGraceMs + leaseMarginMs);
  });

  test('renews the lock while a run outlasts its lease', async () => {
    const script = defineScript({
      input: noInput,
      name: 'long-runner',
      run: async () => {
        await new Promise((resolve) => {
          globalThis.setTimeout(resolve, 4000);
        });
      },
    });
    const lease = { leaseMs: 3000, renewEveryMs: 300 };

    const first = runScript(script, options({ abortGraceMs: 10, lease }));
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 3500);
    });
    const overlapping = await runScript(script, options({ abortGraceMs: 10, lease }));
    const firstResult = await first;

    expect(overlapping.outcome).toBe('skipped');
    expect(firstResult.outcome).toBe('succeeded');
    expect(await lockOf(script)).toBeUndefined();
  });

  test.each([
    ['was taken over', takenOver, 60_000, 'Script lock was taken over; aborting the run'],
    [
      'cannot be renewed',
      unreachable,
      400,
      'Script lock could not be renewed in time; aborting the run',
    ],
  ] as const)(
    'ends the run as lock-lost when its lock %s',
    async (description, renew, leaseMs, message) => {
      const warn = vi.spyOn(logger, 'warn');
      vi.spyOn(logger, 'error').mockImplementation(() => {});
      const script = defineScript({
        input: noInput,
        name: `lock-${description.replaceAll(' ', '-')}`,
        run: async (_input, context) => {
          await untilAborted(context);
        },
      });

      const result = await runScript(
        script,
        options({
          abortGraceMs: 10,
          lease: { leaseMs, renewEveryMs: 100 },
          openDatabase: losingDatabase(renew),
        }),
      );

      expect(result.outcome).toBe('lock-lost');
      expect(warn).toHaveBeenCalledWith(message, { leaseMs });
      expect(await lockOf(script)).toBeUndefined();
    },
  );

  test('reports lock-lost when the lock was taken over without the heartbeat noticing', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const script = defineScript({
      input: noInput,
      name: 'silently-overtaken',
      run: async (_input, { db }) => {
        await db.scriptLocks.acquire({
          leaseMs: 60_000,
          name: `${lockScope}/silently-overtaken`,
          now: new Date(Date.now() + 10 * 60_000),
          owner: 'another-run',
        });
      },
    });

    const result = await runScript(script, options());

    expect(result).toMatchObject({ error: 'Script lost its lock', outcome: 'lock-lost' });
    expect(error).toHaveBeenCalledWith(
      'Script lost its lock while running (did it block the event loop for about its lease or longer?); another run may have overlapped with it',
      { leaseMs: defaultLease.leaseMs },
    );
    expect(await lockOf(script)).toMatchObject({ owner: 'another-run' });
  });

  test('reports lock-lost even when the script then fails with its own error', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const script = defineScript({
      input: noInput,
      name: 'fails-after-losing',
      run: async (_input, context) => {
        await untilAborted(context);
        throw new Error('cleanup failed');
      },
    });

    const result = await runScript(
      script,
      options({
        abortGraceMs: 1000,
        lease: { leaseMs: 60_000, renewEveryMs: 100 },
        openDatabase: losingDatabase(takenOver),
      }),
    );

    expect(result.outcome).toBe('lock-lost');
  });

  test('rejects a lease too short for its renewal interval', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const run = vi.fn(succeeds);
    const script = defineScript({ input: noInput, name: 'bad-lease', run });

    const result = await runScript(
      script,
      options({ lease: { leaseMs: 30_000, renewEveryMs: 15_000 } }),
    );

    expect(result).toMatchObject({
      error: 'lease of 30000ms cannot be renewed every 15000ms with a 5000ms abort grace',
      outcome: 'failed',
    });
    expect(run).not.toHaveBeenCalled();
    expect(checkLease(defaultLease, defaultAbortGraceMs)).toBeUndefined();
    expect(checkLease({ leaseMs: 60_000, renewEveryMs: 0 }, 10)).toBeDefined();
    expect(checkLease({ leaseMs: 60_000, renewEveryMs: -1 }, 10)).toBeDefined();
    expect(checkLease({ leaseMs: 60_000.5, renewEveryMs: 100 }, 10)).toBeDefined();
  });

  test('warns loudly when a script ignores its abort after losing its lock', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const script = defineScript({
      input: noInput,
      name: 'lost-and-stubborn',
      run: async () => {
        await new Promise<void>(() => {});
      },
    });

    const result = await runScript(
      script,
      options({
        abortGraceMs: 10,
        lease: { leaseMs: 400, renewEveryMs: 100 },
        openDatabase: losingDatabase(takenOver),
      }),
    );

    expect(result.outcome).toBe('lock-lost');
    expect(error).toHaveBeenCalledWith(
      'Script ignored its abort after losing its lock; another run may now overlap with it',
      undefined,
    );
  });

  test('reports a thrown error as failed and frees the lock', async () => {
    const error = vi.spyOn(logger, 'error');
    const script = defineScript({
      input: noInput,
      name: 'broken',
      run: async () => {
        await Promise.resolve();
        throw new Error('boom');
      },
    });

    const result = await runScript(script, options());

    expect(result).toMatchObject({ error: 'boom', outcome: 'failed' });
    expect(error).toHaveBeenCalledWith(
      'Script broken failed',
      expect.objectContaining({ error: 'boom' }),
    );
    expect(await lockOf(script)).toBeUndefined();
  });

  test('describes a thrown non-Error', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const script = defineScript({
      input: noInput,
      name: 'throws-object',
      run: async () => {
        await Promise.resolve();
        throw Object.assign(Object.create(null), { code: 7 });
      },
    });

    const result = await runScript(script, options());

    expect(result).toMatchObject({ error: '{"code":7}', outcome: 'failed' });
  });

  test('rejects invalid input before opening the database', async () => {
    const run = vi.fn(succeeds);
    const open = vi.fn(openDatabase);
    const script = defineScript({ input: z.object({ id: z.string() }), name: 'needs-id', run });

    const result = await runScript(script, options({ openDatabase: open }));

    expect(result.outcome).toBe('invalid-input');
    expect(result.error).toContain('id');
    expect(run).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  test.each([
    ['failed', new Error('schema bug')],
    ['invalid-input', new InvalidInputError('rejected by a refine')],
  ] as const)('reports %s when the input schema itself throws', async (outcome, thrown) => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const run = vi.fn(succeeds);
    const script = defineScript({
      input: z.object({}).transform(() => {
        throw thrown;
      }),
      name: `throwing-schema-${outcome}`,
      run,
    });

    const result = await runScript(script, options());

    expect(result).toMatchObject({ error: thrown.message, outcome });
    expect(run).not.toHaveBeenCalled();
  });

  test('a stop or the timeout interrupts a hung database open, closing it if it opens late', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const run = vi.fn(succeeds);
    const script = defineScript({ input: noInput, name: 'hung-open', run, timeoutMs: 20 });
    const opening = Promise.withResolvers<repositories.Database>();
    const closes: number[] = [];

    const result = await runScript(
      script,
      options({ abortGraceMs: 10, openDatabase: async () => await opening.promise }),
    );
    const database = await openDatabase();
    opening.resolve({
      ...database,
      close: async () => {
        closes.push(1);
        await Promise.resolve();
        throw new Error('late close failed');
      },
    });
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        'Closing a database that opened after the run was abandoned failed',
        { error: new Error('late close failed') },
      );
    });
    expect(closes).toHaveLength(1);

    expect(result).toMatchObject({ error: 'Script timed out', outcome: 'timed-out' });
    expect(run).not.toHaveBeenCalled();
  });

  test('a stop interrupts a hung lock acquisition and releases a lock taken late', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const run = vi.fn(succeeds);
    const script = defineScript({ input: noInput, name: 'hung-acquire', run });
    const stop = new globalThis.AbortController();
    const acquiring = Promise.withResolvers<boolean>();
    const released: boolean[] = [];
    const open = async (): Promise<repositories.Database> => {
      const database = await openDatabase();
      return {
        ...database,
        close: async () => {},
        scriptLocks: {
          ...database.scriptLocks,
          acquire: async (lock) => {
            stop.abort();
            await acquiring.promise;
            return await database.scriptLocks.acquire(lock);
          },
          release: async (lock) => {
            const done = await database.scriptLocks.release(lock);
            released.push(done);
            return done;
          },
        },
      };
    };

    const result = await runScript(
      script,
      options({ abortGraceMs: 10, openDatabase: open, signal: stop.signal }),
    );
    expect(await lockOf(script)).toBeUndefined();
    acquiring.resolve(true);
    await vi.waitFor(() => {
      expect(released).toStrictEqual([true]);
    });
    expect(await lockOf(script)).toBeUndefined();

    expect(result).toMatchObject({ error: 'Script aborted', outcome: 'aborted' });
    expect(run).not.toHaveBeenCalled();
  });

  test('releases a lock taken late after a stop before closing the database', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const script = defineScript({ input: noInput, name: 'late-lock', run: succeeds });
    const stop = new globalThis.AbortController();
    const events: string[] = [];
    const open = async (): Promise<repositories.Database> => {
      const database = await openDatabase();
      return {
        ...database,
        close: async () => {
          events.push('closed');
          await database.close();
        },
        scriptLocks: {
          ...database.scriptLocks,
          acquire: async (lock) => {
            stop.abort();
            await new Promise((resolve) => {
              globalThis.setTimeout(resolve, 300);
            });
            return await database.scriptLocks.acquire(lock);
          },
          release: async (lock) => {
            const done = await database.scriptLocks.release(lock);
            events.push(`released:${String(done)}`);
            return done;
          },
        },
      };
    };

    const result = await runScript(
      script,
      options({ abortGraceMs: 200, openDatabase: open, signal: stop.signal }),
    );

    expect(result.outcome).toBe('aborted');
    expect(events).toStrictEqual(['released:true', 'closed']);
    expect(await lockOf(script)).toBeUndefined();
  });

  test('retries a failed release', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const attempts: number[] = [];
    const script = defineScript({ input: noInput, name: 'flaky-release', run: succeeds });
    const open = async (): Promise<repositories.Database> => {
      const database = await openDatabase();
      return {
        ...database,
        scriptLocks: {
          ...database.scriptLocks,
          release: async (lock) => {
            attempts.push(1);
            if (attempts.length === 1) {
              throw new Error('connection reset');
            }
            return await database.scriptLocks.release(lock);
          },
        },
      };
    };

    const result = await runScript(script, options({ openDatabase: open }));

    expect(result.outcome).toBe('succeeded');
    expect(attempts).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
    expect(await lockOf(script)).toBeUndefined();
  });

  test('does not report a lost lock when a retried release finds it already deleted', async () => {
    const error = vi.spyOn(logger, 'error');
    const warn = vi.spyOn(logger, 'warn');
    const script = defineScript({ input: noInput, name: 'release-reply-lost', run: succeeds });
    const attempts: number[] = [];
    const open = async (): Promise<repositories.Database> => {
      const database = await openDatabase();
      return {
        ...database,
        scriptLocks: {
          ...database.scriptLocks,
          release: async (lock) => {
            attempts.push(1);
            const released = await database.scriptLocks.release(lock);
            if (attempts.length === 1) {
              throw new Error('connection closed before the reply');
            }
            return released;
          },
        },
      };
    };

    const result = await runScript(script, options({ openDatabase: open }));

    expect(result.outcome).toBe('succeeded');
    expect(attempts).toHaveLength(2);
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'Could not confirm the script lock was released; it frees itself when the lease ends',
      {
        errors: [new Error('connection closed before the reply')],
        leaseMs: defaultLease.leaseMs,
        timedOut: false,
      },
    );
    expect(await lockOf(script)).toBeUndefined();
  });

  test('releases a lock whose acquisition committed but then failed', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const run = vi.fn(succeeds);
    const script = defineScript({ input: noInput, name: 'acquire-reply-lost', run });
    const result = await runScript(script, options({ openDatabase: acquireReplyLostDatabase }));

    expect(result).toMatchObject({
      error: 'connection closed before the reply',
      outcome: 'failed',
    });
    expect(run).not.toHaveBeenCalled();
    expect(await lockOf(script)).toBeUndefined();
  });

  test('gives up on a release that hangs past its timeout', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const script = defineScript({ input: noInput, name: 'hung-release', run: succeeds });
    const startedAt = Date.now();

    const result = await runScript(
      script,
      options({ openDatabase: hangingReleaseDatabase, releaseTimeoutMs: 100 }),
    );

    expect(result.outcome).toBe('succeeded');
    expect(Date.now() - startedAt).toBeLessThan(5000);
    expect(warn).toHaveBeenCalledWith(
      'Could not confirm the script lock was released; it frees itself when the lease ends',
      { leaseMs: defaultLease.leaseMs, timedOut: true },
    );
  });

  test('stops retrying a release once it gave up', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const attempts: number[] = [];
    const script = defineScript({ input: noInput, name: 'failing-release', run: succeeds });
    const open = async (): Promise<repositories.Database> => {
      const database = await openDatabase();
      return {
        ...database,
        scriptLocks: {
          ...database.scriptLocks,
          release: async () => {
            attempts.push(1);
            await Promise.resolve();
            throw new Error('database unreachable');
          },
        },
      };
    };

    const result = await runScript(script, options({ openDatabase: open, releaseTimeoutMs: 100 }));
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 900);
    });

    expect(result.outcome).toBe('succeeded');
    expect(attempts).toHaveLength(1);
  });

  test.each([
    ['fails', true],
    ['comes back refused', false],
  ] as const)(
    'after a stop, an acquisition that later %s is released only if it may hold the lock',
    async (late, releases) => {
      vi.spyOn(logger, 'error').mockImplementation(() => {});
      const stop = new globalThis.AbortController();
      const released: boolean[] = [];
      const script = defineScript({
        input: noInput,
        name: `abandoned-${late.replaceAll(' ', '-')}`,
        run: succeeds,
      });
      const open = async (): Promise<repositories.Database> => {
        const database = await openDatabase();
        return {
          ...database,
          scriptLocks: {
            ...database.scriptLocks,
            acquire: async (lock) => {
              stop.abort();
              await new Promise((resolve) => {
                globalThis.setTimeout(resolve, 300);
              });
              if (!releases) {
                return false;
              }
              await database.scriptLocks.acquire(lock);
              throw new Error('connection closed before the reply');
            },
            release: async (lock) => {
              const done = await database.scriptLocks.release(lock);
              released.push(done);
              return done;
            },
          },
        };
      };

      const result = await runScript(
        script,
        options({ abortGraceMs: 100, openDatabase: open, signal: stop.signal }),
      );

      expect(result.outcome).toBe('aborted');
      expect(released).toStrictEqual(releases ? [true] : []);
      expect(await lockOf(script)).toBeUndefined();
    },
  );

  test('renews right away after a slow lock acquisition instead of giving the run up', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const renewals: number[] = [];
    const script = defineScript({
      input: noInput,
      name: 'slow-acquire',
      run: async () => {
        await new Promise((resolve) => {
          globalThis.setTimeout(resolve, 300);
        });
      },
    });
    const open = async (): Promise<repositories.Database> => {
      const database = await openDatabase();
      return {
        ...database,
        scriptLocks: {
          ...database.scriptLocks,
          acquire: async (lock) => {
            await new Promise((resolve) => {
              globalThis.setTimeout(resolve, 800);
            });
            return await database.scriptLocks.acquire(lock);
          },
          renew: async (renewal) => {
            renewals.push(Date.now());
            return await database.scriptLocks.renew(renewal);
          },
        },
      };
    };

    const result = await runScript(
      script,
      options({
        abortGraceMs: 10,
        lease: { leaseMs: 1000, renewEveryMs: 100 },
        openDatabase: open,
      }),
    );

    expect(result.outcome).toBe('succeeded');
    expect(renewals.length).toBeGreaterThanOrEqual(1);
    expect(warn).not.toHaveBeenCalled();
  });

  test('fails without running when the database cannot be opened', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const run = vi.fn(succeeds);
    const script = defineScript({ input: noInput, name: 'no-db', run });

    const result = await runScript(
      script,
      options({
        openDatabase: async () => {
          await Promise.resolve();
          throw new Error('unreachable');
        },
      }),
    );

    expect(result).toMatchObject({ error: 'unreachable', outcome: 'failed' });
    expect(run).not.toHaveBeenCalled();
  });

  test('aborts a run that exceeds its timeout and frees the lock', async () => {
    const script = defineScript({
      input: noInput,
      name: 'slow',
      run: async (_input, context) => {
        await untilAborted(context);
      },
      timeoutMs: 1000,
    });

    const result = await runScript(script, options());

    expect(result.outcome).toBe('timed-out');
    expect(await lockOf(script)).toBeUndefined();
  });

  test('caps the run at maxRunMs, under the usual lease', async () => {
    const leases: number[] = [];
    const script = defineScript({
      input: noInput,
      name: 'capped',
      run: async (_input, context) => {
        await untilAborted(context);
      },
      timeoutMs: 60_000,
    });
    const open = async (): Promise<repositories.Database> => {
      const database = await openDatabase();
      return {
        ...database,
        scriptLocks: {
          ...database.scriptLocks,
          acquire: async (lock) => {
            leases.push(lock.leaseMs);
            return await database.scriptLocks.acquire(lock);
          },
        },
      };
    };

    const result = await runScript(script, options({ maxRunMs: 10, openDatabase: open }));

    expect(result.outcome).toBe('timed-out');
    expect(leases).toStrictEqual([defaultLease.leaseMs]);
  });

  test('aborts a timed-out script with a TimeoutError it can recognise', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const seen: DOMException[] = [];
    const script = defineScript({
      input: noInput,
      name: 'sees-timeout',
      run: async (_input, context) => {
        await untilAborted(context);
        try {
          context.signal.throwIfAborted();
        } catch (error) {
          if (error instanceof globalThis.DOMException) {
            seen.push(error);
          }
          throw error;
        }
      },
      timeoutMs: 1000,
    });

    const result = await runScript(script, options());

    expect(result.outcome).toBe('timed-out');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ message: 'Script timed out', name: 'TimeoutError' });
  });

  test('aborts on the stop signal', async () => {
    const stop = new globalThis.AbortController();
    const script = defineScript({
      input: noInput,
      name: 'stoppable',
      run: async (_input, context) => {
        stop.abort();
        await untilAborted(context);
      },
    });

    const result = await runScript(script, options({ signal: stop.signal }));

    expect(result.outcome).toBe('aborted');
  });

  test('reports a stop as aborted even when the timeout fires during the grace', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const stop = new globalThis.AbortController();
    const script = defineScript({
      input: noInput,
      name: 'stopped-then-timed-out',
      run: async (_input, context) => {
        stop.abort();
        await untilAborted(context);
        await new Promise<void>((resolve) => {
          globalThis.setTimeout(resolve, 1200);
        });
      },
      timeoutMs: 1000,
    });

    const result = await runScript(script, options({ signal: stop.signal }));

    expect(result.outcome).toBe('aborted');
  });

  test('waits for a script that rejects on abort within the grace', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const script = defineScript({
      input: noInput,
      name: 'cleans-up',
      run: async (_input, context) => {
        await untilAborted(context);
        throw new Error('cleaned up');
      },
      timeoutMs: 1000,
    });

    const result = await runScript(script, options());

    expect(result).toMatchObject({ error: 'Script aborted', outcome: 'timed-out' });
    expect(warn).not.toHaveBeenCalled();
  });

  test('gives up on a script that ignores the abort, but keeps its lock and database', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const closes: number[] = [];
    const script = defineScript({
      input: noInput,
      name: 'stubborn',
      run: async () => {
        await new Promise<void>(() => {});
      },
      timeoutMs: 1000,
    });
    const open = async (): Promise<repositories.Database> => {
      const database = await openDatabase();
      return {
        ...database,
        close: async () => {
          closes.push(1);
          await database.close();
        },
      };
    };

    const result = await runScript(script, options({ abortGraceMs: 10, openDatabase: open }));

    expect(result.outcome).toBe('timed-out');
    expect(warn).toHaveBeenCalledWith(
      'Script ignored abort and is still running after 10ms',
      undefined,
    );
    expect(warn).toHaveBeenCalledWith(
      'Script may still be running; its lock stays until the lease ends',
      { leaseMs: defaultLease.leaseMs },
    );
    expect(await lockOf(script)).toMatchObject({ name: `${lockScope}/stubborn` });
    expect(closes).toStrictEqual([]);
    const overlapping = await runScript(script, options());
    expect(overlapping.outcome).toBe('skipped');
  });

  test('does not start once the stop signal has fired', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const run = vi.fn(succeeds);
    const script = defineScript({ input: noInput, name: 'stopped-early', run });
    const stop = new globalThis.AbortController();
    stop.abort();
    const open = vi.fn(openDatabase);

    const result = await runScript(script, options({ openDatabase: open, signal: stop.signal }));

    expect(result).toMatchObject({ error: 'Script aborted', outcome: 'aborted' });
    expect(run).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(await lockOf(script)).toBeUndefined();
  });

  test('does not run when the stop fires while the lock is being taken', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const run = vi.fn(succeeds);
    const script = defineScript({ input: noInput, name: 'stopped-at-lock', run });
    const stop = new globalThis.AbortController();
    const open = async (): Promise<repositories.Database> => {
      const database = await openDatabase();
      return {
        ...database,
        scriptLocks: {
          ...database.scriptLocks,
          acquire: async (lock) => {
            const acquired = await database.scriptLocks.acquire(lock);
            stop.abort();
            return acquired;
          },
        },
      };
    };

    const result = await runScript(script, options({ openDatabase: open, signal: stop.signal }));

    expect(result.outcome).toBe('aborted');
    expect(run).not.toHaveBeenCalled();
    expect(await lockOf(script)).toBeUndefined();
  });

  test('reports an InvalidInputError thrown by the script as invalid-input', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const script = defineScript({
      input: noInput,
      name: 'checks-more',
      run: async () => {
        await Promise.resolve();
        throw new InvalidInputError('no such user');
      },
    });

    const result = await runScript(script, options());

    expect(result).toMatchObject({ error: 'no such user', outcome: 'invalid-input' });
  });

  test('parses the input once per run', async () => {
    const parses: number[] = [];
    const script = defineScript({
      input: z.object({}).transform((value) => {
        parses.push(1);
        return value;
      }),
      name: 'parsed-once',
      run: succeeds,
    });

    const result = await runScript(script, options());

    expect(result.outcome).toBe('succeeded');
    expect(parses).toHaveLength(1);
  });

  test('runs withTrace callbacks inside the run span', async () => {
    const script = defineScript({
      input: noInput,
      name: 'traced',
      run: async (_input, { withTrace }) => {
        expect(await withTrace(async () => await Promise.resolve(42))).toBe(42);
      },
    });

    const result = await runScript(script, options());
    expect(result.outcome).toBe('succeeded');
  });

  test('closes the database after the run and logs a failing close or release', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const closes: number[] = [];
    const script = defineScript({ input: noInput, name: 'cleanup', run: succeeds });
    const open = async (): Promise<repositories.Database> => {
      const database = await openDatabase();
      return {
        ...database,
        close: async () => {
          closes.push(1);
          await Promise.resolve();
          throw new Error('close failed');
        },
        scriptLocks: {
          ...database.scriptLocks,
          release: async () => {
            await Promise.resolve();
            throw new Error('release failed');
          },
        },
      };
    };

    const result = await runScript(script, options({ openDatabase: open }));

    expect(result.outcome).toBe('succeeded');
    expect(closes).toHaveLength(1);
    const releaseWarning = warn.mock.calls.find(
      ([message]) =>
        message ===
        'Could not confirm the script lock was released; it frees itself when the lease ends',
    );
    expect(releaseWarning?.[1]).toStrictEqual({
      errors: [
        new Error('release failed'),
        new Error('release failed'),
        new Error('release failed'),
      ],
      leaseMs: defaultLease.leaseMs,
      timedOut: false,
    });
    expect(warn).toHaveBeenCalledWith('Closing the database failed', expect.anything());
  });
});

describe('attempt', () => {
  test.each([
    ['aborted', () => globalThis.AbortSignal.abort(), 'Script aborted'],
    [
      'timed-out',
      (timeoutError: DOMException) => globalThis.AbortSignal.abort(timeoutError),
      'Script timed out',
    ],
  ] as const)('never starts a script once the run is %s', async (outcome, signalFor, error) => {
    const run = vi.fn(succeeds);
    const timeoutError = new globalThis.DOMException('Script timed out', 'TimeoutError');

    const attempted = await attempt(run, {
      abortGraceMs: 10,
      active: otelContext.active(),
      database: await openDatabase(),
      logger,
      scheduledTime: new Date(0),
      signal: signalFor(timeoutError),
      timeoutError,
      trigger: 'manual',
    });

    expect(attempted).toStrictEqual({ error, outcome, settled: true });
    expect(run).not.toHaveBeenCalled();
  });
});

describe('abandonOnAbort', () => {
  test('swallows a failure of the abandoned work instead of cleaning up', async () => {
    const cleanUp = vi.fn(succeeds);

    await expect(
      abandonOnAbort(
        Promise.reject(new Error('late failure')),
        globalThis.AbortSignal.abort(),
        10,
        cleanUp,
        [],
      ),
    ).rejects.toBeInstanceOf(ScriptAbortedError);
    expect(cleanUp).not.toHaveBeenCalled();
  });

  test('swallows a cleanup that fails', async () => {
    const cleanUp = vi.fn(async () => {
      await Promise.resolve();
      throw new Error('cleanup failed');
    });

    await expect(
      abandonOnAbort(Promise.resolve(1), globalThis.AbortSignal.abort(), 10, cleanUp, []),
    ).rejects.toBeInstanceOf(ScriptAbortedError);
    expect(cleanUp).toHaveBeenCalledWith(1);
  });
});

describe('renewAfterSlowAcquire', () => {
  const lock = { name: `${lockScope}/renew-after-slow`, owner: 'owner' };
  const lease = { leaseMs: 1000, renewEveryMs: 100 };

  test('keeps the acquisition time when it was quick, without renewing', async () => {
    const database = await openDatabase();
    const renew = vi.spyOn(database.scriptLocks, 'renew');
    const sentAt = Date.now();

    await expect(renewAfterSlowAcquire(database, lock, lease, sentAt)).resolves.toBe(sentAt);
    expect(renew).not.toHaveBeenCalled();
  });

  test('keeps the acquisition time when the renewal fails', async () => {
    const database = await openDatabase();
    vi.spyOn(database.scriptLocks, 'renew').mockRejectedValue(new Error('database unreachable'));
    const sentAt = Date.now() - 500;

    await expect(renewAfterSlowAcquire(database, lock, lease, sentAt)).resolves.toBe(sentAt);
  });
});
