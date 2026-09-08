import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/db.js';
import { runSeed } from '../src/seeds/seedContent.js';
import { listThemes, listLessons, listSentences } from '../src/content/contentService.js';

beforeEach(async () => {
  await runSeed(prisma as unknown as Parameters<typeof runSeed>[0]);
});

describe('contentService', () => {
  it('lists 3 themes ordered', async () => {
    const themes = await listThemes();
    expect(themes).toHaveLength(3);
    expect(themes[0].order).toBeLessThanOrEqual(themes[1].order);
  });

  it('lists 4 lessons for animals', async () => {
    const lessons = await listLessons('animals');
    expect(lessons).toHaveLength(4);
    expect(lessons.every((l) => l.themeId === 'animals')).toBe(true);
  });

  it('lists 6 sentences for animals-1', async () => {
    const sentences = await listSentences('animals-1');
    expect(sentences).toHaveLength(6);
    expect(sentences[0].enText.length).toBeGreaterThan(0);
  });
});
