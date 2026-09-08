import { prisma } from '../db.js';

export async function listThemes() {
  return prisma.theme.findMany({ orderBy: { order: 'asc' } });
}

export async function listLessons(themeId: string) {
  return prisma.lesson.findMany({ where: { themeId }, orderBy: { difficulty: 'asc' } });
}

export async function listSentences(lessonId: string) {
  return prisma.sentence.findMany({ where: { lessonId } });
}
