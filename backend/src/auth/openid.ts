export type WxAppCreds = { appId: string; appSecret: string };

export async function code2openid(code: string, creds: WxAppCreds): Promise<string> {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${creds.appId}&secret=${creds.appSecret}&js_code=${code}&grant_type=authorization_code`;
  const res = await fetch(url);
  const body = (await res.json()) as { openid?: string; errcode?: number; errmsg?: string };
  if (!body.openid) {
    throw new Error(`wx login failed: ${body.errcode} ${body.errmsg ?? ''}`);
  }
  return body.openid;
}
