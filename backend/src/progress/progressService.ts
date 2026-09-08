import { prisma } from '../db.js';

const PASS_THRESHOLD = 60; // 单句及格分

export async function ensureUser(openid: string, nickname: string, avatar: string) {
  return prisma.user.upsert({
    where: { openid },
    create: { userId: `u_${openid}`, openid, nickname, avatar },
    update: {},
  });
}

export async function getOrCreateProgress(userId: string, lessonId: string) {
  const existing = await prisma.userProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });
  if (existing) return existing;

  // 判断是否应解锁：是该主题第一关 或 前一关已 done
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { lessonId } });
  const themeLessons = await prisma.lesson.findMany({
    where: { themeId: lesson.themeId },
    orderBy: { difficulty: 'asc' },
  });
  const idx = themeLessons.findIndex((l) => l.lessonId === lessonId);
  const isFirst = idx === 0;
  let unlocked = isFirst;
  if (!isFirst) {
    const prevId = themeLessons[idx - 1].lessonId;
    const prev = await prisma.userProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: prevId } },
    });
    unlocked = !!prev && prev.status === 'done' && prev.stars >= 1;
  }

  return prisma.userProgress.create({
    data: {
      userId,
      lessonId,
      status: unlocked ? 'unlocked' : 'locked',
      stars: 0,
    },
  });
}

export async function recordAttempt(
  userId: string,
  sentenceId: string,
  score: number,
  retry: boolean,
  timeout: boolean
) {
  return prisma.sentenceAttempt.create({
    data: {
      attemptId: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      sentenceId,
      score,
      retry,
      timeout,
    },
  });
}

export async function finalizeLessonStars(userId: string, lessonId: string, stars: number) {
  await prisma.userProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, stars, status: 'done' },
    update: { stars, status: 'done' },
  });
  // 解锁下一关（同主题内）
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { lessonId } });
  const themeLessons = await prisma.lesson.findMany({
    where: { themeId: lesson.themeId },
    orderBy: { difficulty: 'asc' },
  });
  const idx = themeLessons.findIndex((l) => l.lessonId === lessonId);
  if (idx >= 0 && idx < themeLessons.length - 1) {
    const nextId = themeLessons[idx + 1].lessonId;
    await prisma.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: nextId } },
      create: { userId, lessonId: nextId, status: 'unlocked', stars: 0 },
      update: { status: 'unlocked' },
    });
  }
}

export async function nextLessonUnlocked(userId: string, lessonId: string): Promise<boolean> {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { lessonId } });
  const themeLessons = await prisma.lesson.findMany({
    where: { themeId: lesson.themeId },
    orderBy: { difficulty: 'asc' },
  });
  const idx = themeLessons.findIndex((l) => l.lessonId === lessonId);
  if (idx < 0 || idx >= themeLessons.length - 1) return false;
  const next = await prisma.userProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId: themeLessons[idx + 1].lessonId } },
  });
  return !!next && next.status === 'unlocked';
}

export { PASS_THRESHOLD };
