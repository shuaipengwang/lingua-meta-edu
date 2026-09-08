import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';

describe('health', () => {
  it('returns ok on /health', async () => {
    const server = buildServer();
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await server.close();
  });
});
