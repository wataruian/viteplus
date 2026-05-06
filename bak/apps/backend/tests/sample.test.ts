import type { Express } from 'express';
import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const HTTP_STATUS_OK = 200;

describe('GET /', () => {
  let app: Express;

  beforeAll(async () => {
    const module = await import('../src');
    app = module.default;
  });

  it('should return 200', async () => {
    const response = await Promise.resolve(supertest(app).get('/'));
    expect(response.status).toBe(HTTP_STATUS_OK);
    expect(response.body).toBeDefined();
    expect(response.body.message).toBe('Welcome to the API');
    expect(response.body.status).toBe('ok');
  });
});

describe('GET /api/sample', () => {
  let app: Express;

  beforeAll(async () => {
    const module = await import('../src');
    app = module.default;
  });

  it('should return 200', async () => {
    const response = await Promise.resolve(supertest(app).get('/api/sample'));
    expect(response.status).toBe(HTTP_STATUS_OK);
    expect(response.body).toBeDefined();
    expect(response.body.message).toBe('Hello, world!');
    expect(response.body.status).toBe('ok');
  });
});
