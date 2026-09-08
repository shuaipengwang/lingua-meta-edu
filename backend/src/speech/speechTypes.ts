export type SpeechResult = {
  recognizedText: string;
  score: number;          // 0-100
  isSilent: boolean;      // 无声音/纯噪音
};

export type SpeechProvider = {
  evaluate(args: { audioBase64: string; referenceText: string; format: 'mp3' | 'aac' }): Promise<SpeechResult>;
};
