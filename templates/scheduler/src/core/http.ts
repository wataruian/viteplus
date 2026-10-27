import { logger } from '@lightproject/common/logger';
import { z } from 'zod';

import type { RunOutcome, RunResult } from './runner';
import { type JsonValue, type Script, findScript } from './script';

interface RunRequestOptions {
  run: (script: Script, input: JsonValue) => Promise<RunResult>;
  scripts: readonly Script[];
  token: string | undefined;
}

const minTokenLength = 32;

let misconfigurationReported = false;

const runPath = /^\/run\/(?<name>[^/]+)$/u;

const statusOf: Record<RunOutcome, number> = {
  aborted: 503,
  failed: 500,
  'invalid-input': 400,
  'lock-lost': 503,
  skipped: 409,
  succeeded: 200,
  'timed-out': 504,
};

const json = (
  status: number,
  body: Record<string, JsonValue>,
  headers: Record<string, string> = {},
) => globalThis.Response.json(body, { headers, status });

const digest = async (text: string) =>
  new Uint8Array(
    await globalThis.crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(text)),
  );

const sameSecret = async (given: string, expected: string) => {
  const [left, right] = await Promise.all([digest(given), digest(expected)]);
  let difference = 0;
  for (const [index, byte] of left.entries()) {
    difference += Math.abs(byte - right[index]);
  }
  return difference === 0;
};

const bearerOf = (request: Request) => {
  const match = /^bearer +(?<token>\S+)$/iu.exec(request.headers.get('authorization') ?? '');
  return match?.groups?.['token'];
};

const readInput = async (request: Request): Promise<JsonValue | undefined> => {
  const text = await request.text();
  if (text.trim() === '') {
    return {};
  }
  try {
    return z.json().parse(JSON.parse(text));
  } catch {
    return undefined;
  }
};

const handleRunRequest = async (
  request: Request,
  { run, scripts, token }: RunRequestOptions,
): Promise<Response> => {
  const name = runPath.exec(new globalThis.URL(request.url).pathname)?.groups?.['name'];
  if (name === undefined || token === undefined || token === '') {
    return json(404, { error: 'not found' });
  }
  if (token.length < minTokenLength) {
    if (!misconfigurationReported) {
      misconfigurationReported = true;
      logger.error(
        `The run token is shorter than ${minTokenLength} characters; refusing every run`,
      );
    }
    return json(503, { error: 'run endpoint misconfigured' });
  }
  if (request.method !== 'POST') {
    return json(405, { error: 'method not allowed' }, { allow: 'POST' });
  }
  const given = bearerOf(request);
  if (given === undefined || !(await sameSecret(given, token))) {
    return json(401, { error: 'unauthorized' }, { 'www-authenticate': 'Bearer' });
  }
  const script = findScript(scripts, name);
  if (script === undefined) {
    return json(404, { error: `unknown script "${name}"` });
  }
  const input = await readInput(request);
  if (input === undefined) {
    return json(400, { error: 'the body must be empty or JSON' });
  }
  const { durationMs, error, outcome } = await run(script, input);
  return json(statusOf[outcome], {
    durationMs,
    outcome,
    script: script.name,
    ...(outcome === 'invalid-input' && error !== undefined ? { error } : {}),
    ...(outcome === 'skipped' ? { error: 'a previous run is still in progress' } : {}),
  });
};

export {
  bearerOf,
  digest,
  handleRunRequest,
  json,
  minTokenLength,
  readInput,
  runPath,
  sameSecret,
  statusOf,
};
export type { RunRequestOptions };
