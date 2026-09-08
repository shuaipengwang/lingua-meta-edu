import { prisma } from '../db.js';
import { recordAttempt } from '../progress/progressService.js';
import { decideFeedback } from '../feedback/feedbackPolicy.js';
import type { SpeechProvider } from './speechTypes.js';

const EVAL_TIMEOUT_MS = 2000;

export type EvaluateArgs = {
  userId: string;
  sentenceId: string;
  audioBase64: string;
  format: 'mp3' | 'aac';
  provider: SpeechProvider;
};

export type EvaluateResult = {
  feedback: ReturnType<typeof decideFeedback>;
  score: number;
  recognizedText: string;
};

export async function evaluateAndFeedback(args: EvaluateArgs): Promise<EvaluateResult> {
  const sentence = await prisma.sentence.findUniqueOrThrow({ where: { sentenceId: args.sentenceId } });

  let score = 0;
  let recognizedText = '';
  let isSilent = false;
  let timedOut = false;

  try {
    const result = await withTimeout(
      args.provider.evaluate({ audioBase64: args.audioBase64, referenceText: sentence.enText, format: args.format }),
      EVAL_TIMEOUT_MS
    );
    score = result.score;
    recognizedText = result.recognizedText;
    isSilent = result.isSilent;
  } catch (e) {
    timedOut = true;
  }

  const feedback = decideFeedback(score, isSilent, timedOut);
  await recordAttempt(args.userId, args.sentenceId, score, feedback.branch === 'retry', timedOut);

  return { feedback, score, recognizedText };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
