import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db.js';

describe('db', () => {
  it('can connect and query', async () => {
    const count = await prisma.theme.count();
    expect(typeof count).toBe('number');
  });
});
