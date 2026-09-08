import type { FastifyInstance } from 'fastify';
import { ensureUser, getOrCreateProgress, finalizeLessonStars, nextLessonUnlocked } from './progressService.js';

export async function progressRoutes(server: FastifyInstance) {
  server.post('/auth/login', async (req) => {
    const { code, nickname, avatar } = req.body as { code: string; nickname: string; avatar: string };
    // code → openid 在 routes 层调 auth，service 层只接收 openid
    const { code2openid } = await import('../auth/openid.js');
    const { config } = await import('../config.js');
    const openid = await code2openid(code, { appId: config.wxAppId, appSecret: config.wxAppSecret });
    const user = await ensureUser(openid, nickname, avatar);
    return { userId: user.userId, openid };
  });

  server.get('/progress/:userId/:lessonId', async (req) => {
    const { userId, lessonId } = req.params as { userId: string; lessonId: string };
    return getOrCreateProgress(userId, lessonId);
  });

  server.post('/progress/:userId/:lessonId/finalize', async (req) => {
    const { userId, lessonId } = req.params as { userId: string; lessonId: string };
    const { stars } = req.body as { stars: number };
    await finalizeLessonStars(userId, lessonId, stars);
    const nextUnlocked = await nextLessonUnlocked(userId, lessonId);
    return { ok: true, nextUnlocked };
  });
}
