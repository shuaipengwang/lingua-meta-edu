import { listThemes } from '../../services/lessonClient';

Page({
  data: { themes: [], streak: 1 },

  async onShow() {
    try {
      const themes = await listThemes();
      this.setData({ themes });
    } catch (e) {
      wx.showToast({ title: '稍后再试', icon: 'none' });
    }
  },

  goLessons(e: WechatMiniprogram.TouchEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    wx.navigateTo({ url: `/pages/lessons/lessons?themeId=${id}` });
  },
});
