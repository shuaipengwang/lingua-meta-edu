import type { FastifyInstance } from 'fastify';
import { listThemes, listLessons, listSentences } from './contentService.js';

export async function contentRoutes(server: FastifyInstance) {
  server.get('/themes', async () => listThemes());
  server.get('/themes/:themeId/lessons', async (req) => {
    const { themeId } = req.params as { themeId: string };
    return listLessons(themeId);
  });
  server.get('/lessons/:lessonId/sentences', async (req) => {
    const { lessonId } = req.params as { lessonId: string };
    return listSentences(lessonId);
  });
}
