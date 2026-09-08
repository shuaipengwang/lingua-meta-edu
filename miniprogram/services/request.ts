const BASE = 'http://localhost:3000'; // 开发期；生产替换为后端域名

export type ApiError = { status: number; message: string };

export async function api<T = unknown>(path: string, options: { method?: 'GET' | 'POST'; data?: unknown } = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: BASE + path,
      method: options.method ?? 'GET',
      data: options.data ?? {},
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          reject({ status: res.statusCode, message: `request failed: ${res.statusCode}` } satisfies ApiError);
        }
      },
      fail: (err) => reject({ status: 0, message: err.errMsg } satisfies ApiError),
    });
  });
}
