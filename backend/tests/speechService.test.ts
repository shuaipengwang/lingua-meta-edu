import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../src/db.js';
import { runSeed } from '../src/seeds/seedContent.js';
import { ensureUser } from '../src/progress/progressService.js';
import { evaluateAndFeedback } from '../src/speech/speechService.js';
import type { SpeechProvider } from '../src/speech/speechTypes.js';

const fakeProvider: SpeechProvider = {
  async evaluate() {
    return { recognizedText: 'I see a cat.', score: 88, isSilent: false };
  },
};

beforeEach(async () => {
  await prisma.sentenceAttempt.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.user.deleteMany();
  await runSeed(prisma as unknown as Parameters<typeof runSeed>[0]);
});

describe('speechService.evaluateAndFeedback', () => {
  it('returns praise for high score and records attempt', async () => {
    const u = await ensureUser('wx_o1', 'Tom', 'a.png');
    const sent = await prisma.sentence.findFirstOrThrow({ where: { lessonId: 'animals-1' } });
    const res = await evaluateAndFeedback({
      userId: u.userId,
      sentenceId: sent.sentenceId,
      audioBase64: 'AAAA',
      format: 'mp3',
      provider: fakeProvider,
    });
    expect(res.feedback.branch).toBe('praise');
    const atts = await prisma.sentenceAttempt.findMany({ where: { userId: u.userId } });
    expect(atts).toHaveLength(1);
    expect(atts[0].score).toBe(88);
  });

  it('returns retry and no star for silent audio', async () => {
    const silent: SpeechProvider = { async evaluate() { return { recognizedText: '', score: 0, isSilent: true }; } };
    const u = await ensureUser('wx_o1', 'Tom', 'a.png');
    const sent = await prisma.sentence.findFirstOrThrow({ where: { lessonId: 'animals-1' } });
    const res = await evaluateAndFeedback({
      userId: u.userId,
      sentenceId: sent.sentenceId,
      audioBase64: 'AAAA',
      format: 'mp3',
      provider: silent,
    });
    expect(res.feedback.branch).toBe('retry');
    expect(res.feedback.counts).toBe(false);
  });

  it('returns skip and records timeout=true on provider timeout', async () => {
    const timeoutProvider: SpeechProvider = {
      async evaluate() { throw new Error('timeout'); },
    };
    const u = await ensureUser('wx_o1', 'Tom', 'a.png');
    const sent = await prisma.sentence.findFirstOrThrow({ where: { lessonId: 'animals-1' } });
    const res = await evaluateAndFeedback({
      userId: u.userId,
      sentenceId: sent.sentenceId,
      audioBase64: 'AAAA',
      format: 'mp3',
      provider: timeoutProvider,
    });
    expect(res.feedback.branch).toBe('skip');
    const att = await prisma.sentenceAttempt.findFirstOrThrow({ where: { userId: u.userId } });
    expect(att.timeout).toBe(true);
  });
});
