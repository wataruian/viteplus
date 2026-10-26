import { afterAll, describe, expect, test } from 'vite-plus/test';
import { z } from 'zod';

import { selectDuePending, selectExpiredJobs, selectExpiredLease } from '../../src/d1/worker-jobs';
import { startLocalD1 } from '../shared/local-d1';

const planRows = z.object({ results: z.array(z.object({ detail: z.string() })) });

describe('d1 worker job query plans', async () => {
  const local = await startLocalD1();

  afterAll(async () => {
    await local.dispose();
  });

  const plan = async (query: { toSQL: () => { params: unknown[]; sql: string } }) => {
    const { params, sql } = query.toSQL();
    const { results } = planRows.parse(
      await local.binding
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .bind(...params)
        .all(),
    );
    return results.map(({ detail }) => detail).join('\n');
  };

  test('claim reads due pending jobs in pending-index order, without sorting', async () => {
    const detail = await plan(
      selectDuePending(local.db, { functionName: 'ping', now: new Date() }),
    );

    expect(detail).toMatch(
      /SEARCH worker_jobs USING INDEX worker_jobs_pending_idx \(function_name=\?/u,
    );
    expect(detail).not.toContain('TEMP B-TREE');
  });

  test('claim reads expired leases in running-index order, without sorting', async () => {
    const detail = await plan(
      selectExpiredLease(local.db, { functionName: 'ping', now: new Date() }),
    );

    expect(detail).toMatch(
      /SEARCH worker_jobs USING INDEX worker_jobs_running_idx \(function_name=\?/u,
    );
    expect(detail).not.toContain('TEMP B-TREE');
  });

  test('purge searches the finished index', async () => {
    const detail = await plan(
      selectExpiredJobs(local.db, { limit: 500, status: 'succeeded', updatedBefore: new Date() }),
    );

    expect(detail).toContain('USING INDEX worker_jobs_finished_idx');
    expect(detail).not.toMatch(/^SCAN worker_jobs$/mu);
  });
});
