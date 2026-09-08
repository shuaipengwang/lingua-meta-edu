import { listSentences, finalizeLesson } from '../../services/lessonClient';
import { assetForBranch, type FeedbackBranch } from '../../utils/feedbackAssets';
import { api } from '../../services/request';
import { ensureLogin } from '../../services/auth';

type SpeechEvalResponse = {
  feedback: { branch: FeedbackBranch; teacherLine: string; avatarAnim: string; counts: boolean };
  score: number;
  recognizedText: string;
};

Page({
  data: {
    sentences: [] as Array<{ sentenceId: string; enText: string; cnText: string; audioRef: string; imageRef: string }>,
    index: -1,
    current: null as null | { sentenceId: string; enText: string; cnText: string; audioRef: string; imageRef: string },
    avatarImg: 'cdn://avatar/idle.png',
    teacherLine: '',
    awaitingSpeech: false,
    loadingScore: false,
    finished: false,
    viewOnly: false,
  } as { viewOnly: boolean },

  async onLoad(query: { lessonId: string }) {
    this.checkRecordPermission();
    const sentences = await listSentences(query.lessonId);
    this.setData({ sentences });
    this.next();
  },

  async checkRecordPermission() {
    try {
      const setting = await wx.getSetting();
      if (!setting.authSetting['scope.record']) {
        // 已拒绝过：进入只看不读模式
        this.setData({ viewOnly: true });
      }
    } catch {}
  },

  next() {
    const nextIndex = this.data.index + 1;
    if (nextIndex >= this.data.sentences.length) {
      this.finishLesson();
      return;
    }
    const current = this.data.sentences[nextIndex];
    this.setData({
      index: nextIndex,
      current,
      avatarImg: 'cdn://avatar/teaching.png',
      teacherLine: current.enText,
      awaitingSpeech: false,
    });
    // 预读：模拟老师带读（音频本地预生成，直接播放）
    this.playTeacher(current.audioRef);
    setTimeout(() => {
      this.setData({ awaitingSpeech: true, teacherLine: 'Your turn!' });
    }, 1500);
  },

  playTeacher(audioRef: string) {
    // 实际从 CDN 取音频播放；首版用 innerAudioContext
    const audio = wx.createInnerAudioContext();
    audio.src = audioRef;
    audio.play();
  },

  async onRecorded(e: WechatMiniprogram.CustomEvent<{ tempFilePath: string }>) {
    this.setData({ awaitingSpeech: false, loadingScore: true });
    const { tempFilePath } = e.detail;
    const session = await ensureLogin();
    const sentenceId = this.data.current!.sentenceId;
    const audioBase64 = await this.fileToBase64(tempFilePath);

    try {
      const res = await api<SpeechEvalResponse>('/speech/evaluate', {
        method: 'POST',
        data: { userId: session.userId, sentenceId, audioBase64, format: 'mp3' },
      });
      this.applyFeedback(res.feedback);
    } catch {
      // 降级：网络/服务失败，按 skip 处理，不让孩子卡住
      this.applyFeedback({ branch: 'skip', teacherLine: 'Good try!', avatarAnim: 'smile', counts: false });
    } finally {
      this.setData({ loadingScore: false });
    }
  },

  applyFeedback(fb: { branch: FeedbackBranch; teacherLine: string; avatarAnim: string; counts: boolean }) {
    const asset = assetForBranch(fb.branch);
    this.setData({
      avatarImg: `cdn://avatar/${fb.branch}.png`,
      teacherLine: asset.teacherLine,
    });
    if (fb.branch === 'retry') {
      // 留在本句重试
      setTimeout(() => {
        this.setData({ awaitingSpeech: true, teacherLine: 'Your turn!' });
      }, 1500);
    } else {
      // praise 或 skip 都前进
      setTimeout(() => this.next(), 1200);
    }
  },

  async finishLesson() {
    // 简单得星：基于已完成句数比例（MVP 简化）
    const total = this.data.sentences.length;
    const stars = Math.max(1, Math.min(3, Math.ceil(total / 2))); // 简化：至少 1 星
    const lessonId = (this as unknown as { options: { lessonId?: string } }).options?.lessonId ?? '';
    await finalizeLesson(lessonId, stars);
    this.setData({ finished: true, teacherLine: 'See you next time!', avatarImg: 'cdn://avatar/cheer.png' });
  },

  goSummary() {
    wx.redirectTo({ url: '/pages/summary/summary' });
  },

  fileToBase64(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (r) => resolve(r.data as string),
        fail: reject,
      });
    });
  },
});
