import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../src/server.js';
import { prisma } from '../src/db.js';
import { runSeed } from '../src/seeds/seedContent.js';
import { ensureUser } from '../src/progress/progressService.js';
import type { SpeechProvider } from '../src/speech/speechTypes.js';

// 注入 fake provider：替换默认讯飞
const fakeProvider: SpeechProvider = {
  async evaluate() { return { recognizedText: 'I see a cat.', score: 88, isSilent: false }; },
};

beforeEach(async () => {
  await prisma.sentenceAttempt.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.user.deleteMany();
  await runSeed(prisma as unknown as Parameters<typeof runSeed>[0]);
});

describe('e2e lesson loop', () => {
  it('goes from themes to lesson to feedback to finalize', async () => {
    const server = buildServer();

    // 1. 取主题
    const themes = await server.inject({ method: 'GET', url: '/themes' });
    expect(themes.statusCode).toBe(200);
    expect(themes.json()).toHaveLength(3);

    // 2. 取 animals 关卡和句子
    const lessons = (await server.inject({ method: 'GET', url: '/themes/animals/lessons' })).json() as Array<{ lessonId: string }>;
    const lessonId = lessons[0].lessonId;
    const sentences = (await server.inject({ method: 'GET', url: `/lessons/${lessonId}/sentences` })).json() as Array<{ sentenceId: string }>;
    expect(sentences).toHaveLength(6);

    // 3. 准备一个真实 user（绕过 /auth/login，直接用 ensureUser）
    const u = await ensureUser('wx_e2e_1', 'E2E', 'a.png');

    // 4. 评估第一句（注入 fake provider，需手动调 service 而非路由，因为路由用真实讯飞）
    const { evaluateAndFeedback } = await import('../src/speech/speechService.js');
    const r = await evaluateAndFeedback({
      userId: u.userId,
      sentenceId: sentences[0].sentenceId,
      audioBase64: 'AAAA',
      format: 'mp3',
      provider: fakeProvider,
    });
    expect(r.feedback.branch).toBe('praise');

    // 5. 结课 finalize
    const fin = await server.inject({
      method: 'POST',
      url: `/progress/${u.userId}/${lessonId}/finalize`,
      payload: { stars: 3 },
    });
    expect(fin.statusCode).toBe(200);
    expect(fin.json().ok).toBe(true);

    await server.close();
  });

  it('handles timeout as skip without crashing', async () => {
    const server = buildServer();
    const lessons = (await server.inject({ method: 'GET', url: '/themes/animals/lessons' })).json() as Array<{ lessonId: string }>;
    const sentences = (await server.inject({ method: 'GET', url: `/lessons/${lessons[0].lessonId}/sentences` })).json() as Array<{ sentenceId: string }>;
    const u = await ensureUser('wx_e2e_2', 'E2E', 'a.png');

    const { evaluateAndFeedback } = await import('../src/speech/speechService.js');
    const timeoutProvider: SpeechProvider = { async evaluate() { throw new Error('timeout'); } };
    const r = await evaluateAndFeedback({
      userId: u.userId,
      sentenceId: sentences[0].sentenceId,
      audioBase64: 'AAAA',
      format: 'mp3',
      provider: timeoutProvider,
    });
    expect(r.feedback.branch).toBe('skip');

    await server.close();
  });
});
