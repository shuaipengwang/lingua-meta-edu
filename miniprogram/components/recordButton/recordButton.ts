const recorder = wx.getRecorderManager();

Component({
  data: { recording: false },
  methods: {
    onStart() {
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
