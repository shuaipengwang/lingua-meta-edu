import { describe, it, expect, vi } from 'vitest';
import { createXfyunClient } from '../src/speech/xfyunClient.js';

describe('xfyunClient', () => {
  it('maps a successful response to SpeechResult', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { rec: 'I see a cat.', score: 85 }, data: { ws: [{ wb: [{ score: 85 }] }] } }), { status: 200 })
    );
    const client = createXfyunClient({ appId: 'a', apiKey: 'k', apiSecret: 's' });
    const r = await client.evaluate({ audioBase64: 'AAAA', referenceText: 'I see a cat.', format: 'mp3' });
    expect(r.recognizedText).toBe('I see a cat.');
    expect(r.score).toBe(85);
    expect(r.isSilent).toBe(false);
    fetchSpy.mockRestore();
  });

  it('treats empty recognition as silent', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { rec: '', score: 0 } }), { status: 200 })
    );
    const client = createXfyunClient({ appId: 'a', apiKey: 'k', apiSecret: 's' });
    const r = await client.evaluate({ audioBase64: 'AAAA', referenceText: 'I see a cat.', format: 'mp3' });
    expect(r.isSilent).toBe(true);
    expect(r.score).toBe(0);
    fetchSpy.mockRestore();
  });
});
