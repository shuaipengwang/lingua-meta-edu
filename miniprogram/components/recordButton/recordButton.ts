const recorder = wx.getRecorderManager();

Component({
  data: { recording: false },
  methods: {
    async onStart() {
      try {
        await wx.authorize({ scope: 'scope.record' });
      } catch {
        // 引导开权限，文案孩子友好
        wx.showModal({
          title: '打开小话筒',
          content: '我们要先开一下小话筒哦',
          confirmText: '去开',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          },
        });
        return;
      }
      this.setData({ recording: true });
      recorder.start({ format: 'mp3', sampleRate: 16000, numberOfChannels: 1 });
    },
    onEnd() {
      if (!this.data.recording) return;
      this.setData({ recording: false });
      recorder.onStop((res) => {
        this.triggerEvent('recorded', { tempFilePath: res.tempFilePath });
      });
      recorder.stop();
    },
  },
});
