/* Chrome experimental AI APIs - Gemini Nano, Translator, Language Detector */
declare const LanguageModel: {
  availability: (opts: { languages?: string[] }) => Promise<string>;
  params: () => Promise<{ defaultTemperature: number; maxTemperature: number; defaultTopK: number; maxTopK: number }>;
  create: (opts: {
    expectedInputs?: Array<{ type: string; languages?: string[] }>;
    expectedOutputs?: Array<{ type: string; languages?: string[] }>;
    temperature?: number;
    topK?: number;
    expectedInputLanguages?: string[];
    initialPrompts?: Array<{ role: string; content: Array<{ type: string; value: string }> }>;
    monitor?: (m: { addEventListener: (e: string, cb: (ev: { loaded: number; total: number }) => void) => void }) => void;
  }) => Promise<{
    destroy: () => void;
    prompt: (text: string) => Promise<string>;
    promptStreaming: (
      messages: Array<{ role: string; content: Array<{ type: string; value: string | Blob }> }>,
      opts?: { signal?: AbortSignal }
    ) => AsyncGenerator<string>;
  }>;
};

declare const Translator: {
  availability: (opts: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
  create: (opts: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: { addEventListener: (e: string, cb: (ev: { loaded: number; total: number }) => void) => void }) => void;
  }) => Promise<{
    translateStreaming: (text: string) => AsyncGenerator<string>;
  }>;
};

declare const LanguageDetector: {
  create: () => Promise<{
    detect: (text: string) => Promise<Array<{ detectedLanguage: string }>>;
  }>;
};
