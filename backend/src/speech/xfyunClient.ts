import type { SpeechProvider, SpeechResult } from './speechTypes.js';
import { config } from '../config.js';

export type XfyunCreds = { appId: string; apiKey: string; apiSecret: string };

type XfyunResponse = {
  result?: { rec?: string; score?: number };
  data?: { ws?: Array<{ wb: Array<{ score: number }> }> };
};

export function createXfyunClient(creds: XfyunCreds): SpeechProvider {
  return {
    async evaluate({ audioBase64, referenceText, format }) {
      const body = {
        common: { app_id: creds.appId },
        business: {
          category: 'read_sentence',
          text: referenceText,
          aus: 1,
        },
        data: {
          status: 2,
          audio: audioBase64,
          aue: format === 'mp3' ? 'lame' : 'aac',
        },
      };

      const res = await fetch('https://raasr.xfyun.cn/v2/ise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as XfyunResponse;
      const rec = json.result?.rec ?? '';
      const score = json.result?.score ?? 0;
      const result: SpeechResult = {
        recognizedText: rec,
        score,
        isSilent: rec.trim().length === 0,
      };
      return result;
    },
  };
}

export const defaultSpeechProvider: SpeechProvider = createXfyunClient({
  appId: config.xfyunAppId,
  apiKey: config.xfyunApiKey,
  apiSecret: config.xfyunApiSecret,
});
