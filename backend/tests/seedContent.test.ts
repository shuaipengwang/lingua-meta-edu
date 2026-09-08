import { describe, it, expect } from 'vitest';
import { seedData } from '../src/seeds/seedContent.js';

describe('seedContent', () => {
  it('has 3 themes', () => {
    expect(seedData.themes).toHaveLength(3);
  });

  it('has 4 lessons per theme', () => {
    for (const t of seedData.themes) {
      const lessons = seedData.lessons.filter((l) => l.themeId === t.themeId);
      expect(lessons).toHaveLength(4);
    }
  });

  it('has 6 sentences per lesson', () => {
    for (const l of seedData.lessons) {
      const s = seedData.sentences.filter((x) => x.lessonId === l.lessonId);
      expect(s).toHaveLength(6);
    }
  });

  it('totals 72 sentences', () => {
    expect(seedData.sentences).toHaveLength(72);
  });

  it('every sentence has non-empty audio and image ref', () => {
    for (const s of seedData.sentences) {
      expect(s.audioRef.length).toBeGreaterThan(0);
      expect(s.imageRef.length).toBeGreaterThan(0);
    }
  });
});
