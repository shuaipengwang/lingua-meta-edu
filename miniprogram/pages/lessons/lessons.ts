import { listLessons, getProgress } from '../../services/lessonClient';

Page({
  data: { lessons: [] as Array<{ lessonId: string; title: string; difficulty: number; statusLabel: string }> },

  async onLoad(query: { themeId: string }) {
    const lessons = await listLessons(query.themeId);
    const withStatus = await Promise.all(
      lessons.map(async (l) => {
        let statusLabel = '未解锁';
        try {
          const p = await getProgress(l.lessonId);
          statusLabel = p.status === 'done' ? '已完成' : p.status === 'unlocked' ? '可学习' : '未解锁';
        } catch {}
        return { lessonId: l.lessonId, title: l.title, difficulty: l.difficulty, statusLabel };
      })
    );
    this.setData({ lessons: withStatus });
  },

  goLesson(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    wx.navigateTo({ url: `/pages/lesson/lesson?lessonId=${id}` });
  },
});
