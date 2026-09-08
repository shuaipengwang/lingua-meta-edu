import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db.js';

describe('db', () => {
  it('can connect and query', async () => {
    const result = await prisma.$queryRaw`SELECT 1 AS ok`;
    expect((result as Array<{ ok: number }>)[0].ok).toBe(1);
  });
});
