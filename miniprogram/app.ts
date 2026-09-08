import { ensureLogin } from './services/auth';

App({
  async onLaunch() {
    try {
      await ensureLogin();
    } catch (e) {
      console.warn('login failed, will retry on demand', e);
    }
  },
});
