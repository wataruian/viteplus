import { afterAll, describe, expect, test } from 'vite-plus/test';

import { DefaultService } from '../src/services/default';
import { TestService } from '../src/services/test';
import { errorEnvelope, httpEnvelope, runtimes, trpcEnvelope } from './helpers/utils';

const successCode = 200;
const httpExceptionCode = 400;

describe.each(runtimes)('on $name', ({ cleanup, importApp }) => {
  afterAll(cleanup);

  describe('DefaultService.root', () => {
    test('GET /api/ returns the standard envelope', async () => {
      const app = await importApp();
      const res = await app.request('/api');
      expect(res.status).toBe(successCode);
      const body: unknown = await res.json();
      const parsed = httpEnvelope(DefaultService.root.schema.response).parse(body);
      expect(parsed.data).toStrictEqual({ status: 'OK' });
    });

    test('default.root query returns the standard tRPC envelope', async () => {
      const app = await importApp();
      const res = await app.request('/trpc/default.root');
      expect(res.status).toBe(successCode);
      const body: unknown = await res.json();
      const parsed = trpcEnvelope(DefaultService.root.schema.response).parse(body);
      expect(parsed.result.data.data).toStrictEqual({ status: 'OK' });
    });
  });

  describe('TestService.hello', () => {
    test('HTTP GET without a name defaults to "World"', async () => {
      const app = await importApp();
      const res = await app.request('/api/test/hello');
      const body: unknown = await res.json();
      const parsed = httpEnvelope(TestService.hello.schema.response).parse(body);
      expect(parsed.data.reply).toBe('Hello World!');
    });

    test('HTTP GET with a name uses it', async () => {
      const app = await importApp();
      const res = await app.request('/api/test/hello?name=Ada');
      const body: unknown = await res.json();
      const parsed = httpEnvelope(TestService.hello.schema.response).parse(body);
      expect(parsed.data.reply).toBe('Hello Ada!');
    });

    test('tRPC query without a name defaults to "World"', async () => {
      const app = await importApp();
      const res = await app.request(
        `/trpc/test.hello?input=${encodeURIComponent(JSON.stringify({}))}`,
      );
      const body: unknown = await res.json();
      const parsed = trpcEnvelope(TestService.hello.schema.response).parse(body);
      expect(parsed.result.data.data.reply).toBe('Hello World!');
    });

    test('tRPC query with a name uses it', async () => {
      const app = await importApp();
      const res = await app.request(
        `/trpc/test.hello?input=${encodeURIComponent(JSON.stringify({ name: 'Ada' }))}`,
      );
      const body: unknown = await res.json();
      const parsed = trpcEnvelope(TestService.hello.schema.response).parse(body);
      expect(parsed.result.data.data.reply).toBe('Hello Ada!');
    });
  });

  describe('TestService.profile', () => {
    const validInput = {
      age: 30,
      name: 'Ada Lovelace',
      preferences: { notifications: true, theme: 'dark' as const },
      tags: ['math', 'engineering'],
    };

    test('valid input via HTTP POST returns the full nested profile shape', async () => {
      const app = await importApp();
      const res = await app.request('/api/test/profile', {
        body: JSON.stringify(validInput),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      expect(res.status).toBe(successCode);
      const body: unknown = await res.json();
      const parsed = httpEnvelope(TestService.profile.schema.response).parse(body);
      expect(parsed.data.id).toBe('profile_ada-lovelace');
      expect(parsed.data.profile).toStrictEqual({
        age: 30,
        name: 'Ada Lovelace',
        tags: ['math', 'engineering'],
      });
      expect(parsed.data.settings).toStrictEqual({ notifications: true, theme: 'dark' });
    });

    test('valid input via tRPC mutation returns the same profile shape', async () => {
      const app = await importApp();
      const res = await app.request('/trpc/test.profile', {
        body: JSON.stringify(validInput),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      expect(res.status).toBe(successCode);
      const body: unknown = await res.json();
      const parsed = trpcEnvelope(TestService.profile.schema.response).parse(body);
      expect(parsed.result.data.data.id).toBe('profile_ada-lovelace');
      expect(parsed.result.data.data.settings).toStrictEqual({
        notifications: true,
        theme: 'dark',
      });
    });

    test.each([
      ['missing fields', {}],
      ['negative age', { ...validInput, age: -1 }],
      [
        'wrong theme enum',
        { ...validInput, preferences: { ...validInput.preferences, theme: 'blue' } },
      ],
      ['wrong tags type', { ...validInput, tags: 'not-an-array' }],
    ])('invalid input (%s) is rejected identically on HTTP and tRPC', async (_label, input) => {
      const app = await importApp();

      const httpRes = await app.request('/api/test/profile', {
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const trpcRes = await app.request('/trpc/test.profile', {
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      expect(httpRes.status).toBe(httpExceptionCode);
      expect(trpcRes.status).toBe(httpExceptionCode);

      const httpParsed = errorEnvelope.parse(await httpRes.json());
      const trpcParsed = errorEnvelope.parse(await trpcRes.json());
      expect(httpParsed.error.code).toBe('HTTP_EXCEPTION');
      expect(trpcParsed.error.code).toBe('HTTP_EXCEPTION');
    });
  });
});
