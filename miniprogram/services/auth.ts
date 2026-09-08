import { api } from './request';

export type Session = { userId: string; openid: string };

export async function ensureLogin(): Promise<Session> {
  const cached = wx.getStorageSync('session') as Session | undefined;
  if (cached?.userId) return cached;

  const { code } = await wx.login();
  // 默认昵称头像，孩子首次进入可改
  const res = await api<Session>('/auth/login', {
    method: 'POST',
    data: { code, nickname: 'Friend', avatar: 'default.png' },
  });
  wx.setStorageSync('session', res);
  return res;
}

export function getSession(): Session | undefined {
  return wx.getStorageSync('session') as Session | undefined;
}
