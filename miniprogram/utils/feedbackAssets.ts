export type FeedbackBranch = 'praise' | 'retry' | 'skip';

export type FeedbackAsset = {
  branch: FeedbackBranch;
  teacherLine: string;
  lottieAnim: string; // 资源路径
};

export const feedbackAssets: Record<FeedbackBranch, FeedbackAsset> = {
  praise: { branch: 'praise', teacherLine: 'Great job!', lottieAnim: 'cdn://anim/cheer.json' },
  retry: { branch: 'retry', teacherLine: "Let's try again!", lottieAnim: 'cdn://anim/slow_read.json' },
  skip: { branch: 'skip', teacherLine: 'Good try!', lottieAnim: 'cdn://anim/smile.json' },
};

export function assetForBranch(branch: FeedbackBranch): FeedbackAsset {
  return feedbackAssets[branch];
}
