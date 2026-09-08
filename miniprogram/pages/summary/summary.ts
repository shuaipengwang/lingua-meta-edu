Page({
  data: { starsText: '★ ★ ★' },

  onShow() {
    // 简化：MVP 直接显示三星占位；后续从后端取本课 stars
    // const stars = wx.getStorageSync('lastStars') ?? 3;
    this.setData({ starsText: '★ ★ ★' });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' });
  },
});
