import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  wxAppId: process.env.WX_APP_ID ?? '',
  wxAppSecret: process.env.WX_APP_SECRET ?? '',
  xfyunAppId: process.env.XFYUN_APP_ID ?? '',
  xfyunApiKey: process.env.XFYUN_API_KEY ?? '',
  xfyunApiSecret: process.env.XFYUN_API_SECRET ?? '',
};
