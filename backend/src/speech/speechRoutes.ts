import type { FastifyInstance } from 'fastify';
import { evaluateAndFeedback } from './speechService.js';
import { defaultSpeechProvider } from './xfyunClient.js';

export async function speechRoutes(server: FastifyInstance) {
  server.post('/speech/evaluate', async (req) => {
    const { userId, sentenceId, audioBase64, format } = req.body as {
      userId: string;
      sentenceId: string;
      audioBase64: string;
      format: 'mp3' | 'aac';
    };
    return evaluateAndFeedback({ userId, sentenceId, audioBase64, format, provider: defaultSpeechProvider });
  });
}
