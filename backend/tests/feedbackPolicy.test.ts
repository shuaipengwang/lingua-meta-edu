import { describe, it, expect } from 'vitest';
import { decideFeedback } from '../src/feedback/feedbackPolicy.js';

describe('feedbackPolicy', () => {
  it('high score → praise', () => {
    expect(decideFeedback(85, false).branch).toBe('praise');
  });
  it('low score → retry', () => {
    expect(decideFeedback(40, false).branch).toBe('retry');
  });
  it('silent → retry with slow read', () => {
    expect(decideFeedback(0, true).branch).toBe('retry');
  });
  it('timeout → skip with neutral praise', () => {
    expect(decideFeedback(0, false, true).branch).toBe('skip');
  });
  it('praise returns a fixed template', () => {
    const fb = decideFeedback(85, false);
    expect(fb.avatarAnim).toBeTruthy();
    expect(fb.teacherLine).toContain('Great');
  });
});
