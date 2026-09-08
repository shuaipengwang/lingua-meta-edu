import { describe, it, expect, vi } from 'vitest';
import { code2openid } from '../src/auth/openid.js';

describe('code2openid', () => {
  it('returns openid on success', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ openid: 'wx_open_123', session_key: 'sk' }), { status: 200 })
    );
    const openid = await code2openid('fake_code', { appId: 'a', appSecret: 's' });
    expect(openid).toBe('wx_open_123');
    fetchSpy.mockRestore();
  });

  it('throws on missing openid in response', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ errcode: 40029, errmsg: 'invalid code' }), { status: 200 })
    );
    await expect(code2openid('bad', { appId: 'a', appSecret: 's' })).rejects.toThrow();
    fetchSpy.mockRestore();
  });
});
