export type FeedbackBranch = 'praise' | 'retry' | 'skip';

export type Feedback = {
  branch: FeedbackBranch;
  teacherLine: string;     // 老师台词
  avatarAnim: string;     // 形象动画资源 key
  counts: boolean;         // 本次是否计星
};

const PRAISE_THRESHOLD = 60;

export function decideFeedback(score: number, isSilent: boolean, timeout = false): Feedback {
  if (timeout) {
    return { branch: 'skip', teacherLine: 'Good try!', avatarAnim: 'smile', counts: false };
  }
  if (isSilent || score < PRAISE_THRESHOLD) {
    return { branch: 'retry', teacherLine: "Let's try again!", avatarAnim: 'slow_read', counts: false };
  }
  return { branch: 'praise', teacherLine: 'Great job!', avatarAnim: 'cheer', counts: true };
}

export { PRAISE_THRESHOLD };
