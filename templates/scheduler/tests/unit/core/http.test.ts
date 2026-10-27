import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

import { handleRunRequest, minTokenLength } from '../../../src/core/http';
import type { RunOutcome, RunResult } from '../../../src/core/runner';
import { type JsonValue, type Script, defineScript } from '../../../src/core/script';

afterEach(() => {
  vi.restoreAllMocks();
});

const token = 'x'.repeat(minTokenLength);

const echo = defineScript({
  input: z.object({ value: z.string().default('none') }),
  name: 'echo',
  run: async () => {},
});

const runWith = (outcome: RunOutcome, error?: string) => {
  const calls: { input: JsonValue; script: Script }[] = [];
  const run = async (script: Script, input: JsonValue): Promise<RunResult> => {
    await Promise.resolve();
    calls.push({ input, script });
    return { durationMs: 5, outcome, ...(error === undefined ? {} : { error }) };
  };
  return { calls, run };
};

const request = (
  path: string,
  {
    authorization = `Bearer ${token}`,
    body,
    method = 'POST',
  }: {
    authorization?: string | null;
    body?: string;
    method?: string;
  } = {},
) =>
  new globalThis.Request(`https://example.test${path}`, {
    ...(body === undefined ? {} : { body }),
    headers: authorization === null ? {} : { authorization },
    method,
  });

describe('handleRunRequest', () => {
  test('runs the script with the JSON body and answers with the outcome', async () => {
    const { calls, run } = runWith('succeeded');

    const response = await handleRunRequest(request('/run/echo', { body: '{"value":"hi"}' }), {
      run,
      scripts: [echo],
      token,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      durationMs: 5,
      outcome: 'succeeded',
      script: 'echo',
    });
    expect(calls).toStrictEqual([{ input: { value: 'hi' }, script: echo }]);
  });

  test.each(['bearer', 'BEARER', 'Bearer  '])(
    'accepts the %j scheme in any case',
    async (scheme) => {
      const { calls, run } = runWith('succeeded');

      const response = await handleRunRequest(
        request('/run/echo', { authorization: `${scheme} ${token}` }),
        { run, scripts: [echo], token },
      );

      expect(response.status).toBe(200);
      expect(calls).toHaveLength(1);
    },
  );

  test('passes {} for an empty body', async () => {
    const { calls, run } = runWith('succeeded');

    await handleRunRequest(request('/run/echo', { body: '  ' }), { run, scripts: [echo], token });
    await handleRunRequest(request('/run/echo'), { run, scripts: [echo], token });

    expect(calls.map(({ input }) => input)).toStrictEqual([{}, {}]);
  });

  test.each([
    ['failed', 500],
    ['timed-out', 504],
    ['aborted', 503],
  ] as const)('maps %s to %i without the error detail', async (outcome, status) => {
    const { run } = runWith(outcome, 'secret detail');

    const response = await handleRunRequest(request('/run/echo'), { run, scripts: [echo], token });

    expect(response.status).toBe(status);
    expect(await response.json()).toStrictEqual({ durationMs: 5, outcome, script: 'echo' });
  });

  test('returns the validation error for invalid input', async () => {
    const { run } = runWith('invalid-input', 'value: expected string');

    const response = await handleRunRequest(request('/run/echo'), { run, scripts: [echo], token });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'value: expected string' });
  });

  test('answers 409 while a previous run holds the lock', async () => {
    const { run } = runWith('skipped');

    const response = await handleRunRequest(request('/run/echo'), { run, scripts: [echo], token });

    expect(response.status).toBe(409);
    expect(await response.json()).toStrictEqual({
      durationMs: 5,
      error: 'a previous run is still in progress',
      outcome: 'skipped',
      script: 'echo',
    });
  });

  test('omits a missing validation message', async () => {
    const { run } = runWith('invalid-input');

    const response = await handleRunRequest(request('/run/echo'), { run, scripts: [echo], token });

    expect(await response.json()).toStrictEqual({
      durationMs: 5,
      outcome: 'invalid-input',
      script: 'echo',
    });
  });

  test.each([
    ['no token configured', request('/run/echo'), undefined, 404],
    ['an empty token', request('/run/echo'), '', 404],
    ['another path', request('/runs/echo'), token, 404],
    ['a nested path', request('/run/echo/x'), token, 404],
    ['an unknown script', request('/run/missing'), token, 404],
    ['GET', request('/run/echo', { method: 'GET' }), token, 405],
    ['no authorization', request('/run/echo', { authorization: null }), token, 401],
    [
      'a wrong token',
      request('/run/echo', { authorization: `Bearer ${'y'.repeat(32)}` }),
      token,
      401,
    ],
    [
      'a token prefix',
      request('/run/echo', { authorization: `Bearer ${token.slice(1)}` }),
      token,
      401,
    ],
    ['basic auth', request('/run/echo', { authorization: `Basic ${token}` }), token, 401],
    [
      'extra credentials',
      request('/run/echo', { authorization: `Bearer ${token} extra` }),
      token,
      401,
    ],
    ['a non-JSON body', request('/run/echo', { body: '{nope' }), token, 400],
  ])('refuses %s without running', async (_case, incoming, configured, status) => {
    const { calls, run } = runWith('succeeded');

    const response = await handleRunRequest(incoming, { run, scripts: [echo], token: configured });

    expect(response.status).toBe(status);
    expect(calls).toStrictEqual([]);
  });

  test('asks for a bearer token on 401', async () => {
    const { run } = runWith('succeeded');

    const response = await handleRunRequest(request('/run/echo', { authorization: null }), {
      run,
      scripts: [echo],
      token,
    });

    expect(response.headers.get('www-authenticate')).toBe('Bearer');
  });

  test('refuses every run while the token is too short', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { calls, run } = runWith('succeeded');

    const response = await handleRunRequest(
      request('/run/echo', { authorization: 'Bearer short' }),
      { run, scripts: [echo], token: 'short' },
    );

    const again = await handleRunRequest(request('/run/echo', { authorization: null }), {
      run,
      scripts: [echo],
      token: 'short',
    });

    expect(response.status).toBe(503);
    expect(again.status).toBe(503);
    expect(calls).toStrictEqual([]);
    expect(error).toHaveBeenCalledOnce();
  });
});
