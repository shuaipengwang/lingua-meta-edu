import { api } from './request';
import { ensureLogin } from './auth';

export type Theme = { themeId: string; name: string; coverImage: string; order: number };
export type Lesson = { lessonId: string; themeId: string; title: string; difficulty: number };
export type Sentence = { sentenceId: string; lessonId: string; enText: string; cnText: string; audioRef: string; imageRef: string };
export type Progress = { userId: string; lessonId: string; stars: number; status: 'locked' | 'unlocked' | 'done' };

export async function listThemes() {
  return api<Theme[]>('/themes');
}
export async function listLessons(themeId: string) {
  return api<Lesson[]>(`/themes/${themeId}/lessons`);
}
export async function listSentences(lessonId: string) {
  return api<Sentence[]>(`/lessons/${lessonId}/sentences`);
}

export async function getProgress(lessonId: string) {
  const s = await ensureLogin();
  return api<Progress>(`/progress/${s.userId}/${lessonId}`);
}

export async function finalizeLesson(lessonId: string, stars: number) {
  const s = await ensureLogin();
  return api<{ ok: boolean; nextUnlocked: boolean }>(`/progress/${s.userId}/${lessonId}/finalize`, {
    method: 'POST',
    data: { stars },
  });
}
