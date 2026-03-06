/* Uses Chrome Translator and LanguageDetector APIs */

type TranslatorInstance = { translateStreaming: (text: string) => AsyncIterable<string> };
type LanguageDetectorInstance = { detect: (text: string) => Promise<Array<{ detectedLanguage: string }>> };

export class TranslationService {
  private translator: TranslatorInstance | null = null;
  private languageDetector: LanguageDetectorInstance | null = null;
  private initializationPromise: Promise<boolean> | null = null;

  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }
    this.initializationPromise = this._doInitialize();
    await this.initializationPromise;
  }

  private async _doInitialize(): Promise<boolean> {
    if (typeof window === "undefined") {
      throw new Error("TranslationService must run in browser");
    }
    const Translator = (window as unknown as { Translator?: { create: (opts: unknown) => Promise<unknown> } }).Translator;
    const LanguageDetector = (window as unknown as { LanguageDetector?: { create: () => Promise<unknown> } }).LanguageDetector;

    if (!Translator || !LanguageDetector) {
      throw new Error("APIs de tradução não disponíveis. Ative as flags em chrome://flags/");
    }

    this.translator = (await Translator.create({
      sourceLanguage: "en",
      targetLanguage: "pt",
      monitor(m: { addEventListener: (e: string, cb: (ev: { loaded: number; total: number }) => void) => void }) {
        m.addEventListener("downloadprogress", (e: { loaded: number; total: number }) => {
          const percent = ((e.loaded / e.total) * 100).toFixed(0);
          console.log(`Translator downloaded ${percent}%`);
        });
      },
    })) as TranslatorInstance;
    console.log("Translator initialized");

    this.languageDetector = (await LanguageDetector.create()) as LanguageDetectorInstance;
    console.log("Language Detector initialized");

    return true;
  }

  async translateToPortuguese(text: string): Promise<string> {
    if (!this.translator) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn("Translator not available, returning original text:", (error as Error).message);
        return text;
      }
    }

    if (!this.translator) {
      console.warn("Translator not available, returning original text");
      return text;
    }

    try {
      if (this.languageDetector) {
        const detectionResults = await this.languageDetector.detect(text);
        console.log("Detected languages:", detectionResults);
        if (detectionResults?.[0]?.detectedLanguage === "pt") {
          console.log("Text is already in Portuguese");
          return text;
        }
      }

      const stream = this.translator.translateStreaming(text);
      let translated = "";
      for await (const chunk of stream) {
        translated = chunk;
      }
      console.log("Translated text:", translated);
      return translated;
    } catch (error) {
      console.error("Translation error:", error);
      return text;
    }
  }
}
