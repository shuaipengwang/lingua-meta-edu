import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/db.js';
import { runSeed } from '../src/seeds/seedContent.js';
import {
  ensureUser,
  getOrCreateProgress,
  recordAttempt,
  finalizeLessonStars,
  nextLessonUnlocked,
} from '../src/progress/progressService.js';

beforeEach(async () => {
  await prisma.sentenceAttempt.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.user.deleteMany();
  await runSeed(prisma as unknown as Parameters<typeof runSeed>[0]);
});

describe('progressService', () => {
  it('ensureUser creates a user with openid', async () => {
    const u = await ensureUser('wx_open_1', 'Tom', 'cat.png');
    expect(u.openid).toBe('wx_open_1');
    expect(u.nickname).toBe('Tom');
  });

  it('ensureUser is idempotent on openid', async () => {
    await ensureUser('wx_open_1', 'Tom', 'cat.png');
    const u2 = await ensureUser('wx_open_1', 'Tom2', 'cat2.png');
    expect(u2.openid).toBe('wx_open_1');
  });

  it('first lesson is unlocked by default', async () => {
    const u = await ensureUser('wx_open_1', 'Tom', 'a.png');
    const p = await getOrCreateProgress(u.userId, 'animals-1');
    expect(p.status).toBe('unlocked');
  });

  it('next lesson is locked until prev has >=1 star', async () => {
    const u = await ensureUser('wx_open_1', 'Tom', 'a.png');
    const p = await getOrCreateProgress(u.userId, 'animals-2');
    expect(p.status).toBe('locked');
  });

  it('recording an attempt stores score and retry flag', async () => {
    const u = await ensureUser('wx_open_1', 'Tom', 'a.png');
    const sent = await prisma.sentence.findFirstOrThrow({ where: { lessonId: 'animals-1' } });
    const att = await recordAttempt(u.userId, sent.sentenceId, 80, false, false);
    expect(att.score).toBe(80);
    expect(att.retry).toBe(false);
  });

  it('finalizeLessonStars sets stars and unlocks next', async () => {
    const u = await ensureUser('wx_open_1', 'Tom', 'a.png');
    await finalizeLessonStars(u.userId, 'animals-1', 3);
    const p1 = await prisma.userProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId: u.userId, lessonId: 'animals-1' } } });
    expect(p1.stars).toBe(3);
    expect(p1.status).toBe('done');
    const p2 = await getOrCreateProgress(u.userId, 'animals-2');
    expect(p2.status).toBe('unlocked');
  });
});
