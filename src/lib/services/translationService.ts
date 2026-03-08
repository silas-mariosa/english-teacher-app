/* Uses Chrome Translator and LanguageDetector APIs */

type TranslatorInstance = { translateStreaming: (text: string) => AsyncIterable<string> };
type LanguageDetectorInstance = { detect: (text: string) => Promise<Array<{ detectedLanguage: string }>> };

export type TranslationTarget = "pt" | "it"

export class TranslationService {
  private translators: Partial<Record<TranslationTarget, TranslatorInstance>> = {};
  private languageDetector: LanguageDetectorInstance | null = null;
  private initDetectorPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initDetectorPromise) {
      await this.initDetectorPromise;
      return;
    }
    this.initDetectorPromise = this._initDetector();
    await this.initDetectorPromise;
  }

  private async _initDetector(): Promise<void> {
    if (typeof window === "undefined") throw new Error("TranslationService must run in browser");
    const LanguageDetector = (window as unknown as { LanguageDetector?: { create: () => Promise<unknown> } }).LanguageDetector;
    if (!LanguageDetector) throw new Error("Language Detector API não disponível.");
    this.languageDetector = (await LanguageDetector.create()) as LanguageDetectorInstance;
  }

  private async getTranslator(target: TranslationTarget): Promise<TranslatorInstance | null> {
    if (this.translators[target]) return this.translators[target] ?? null;
    if (typeof window === "undefined" || !(window as unknown as { Translator?: unknown }).Translator) return null;
    const Translator = (window as unknown as { Translator: { create: (opts: unknown) => Promise<unknown> } }).Translator;
    try {
      const instance = (await Translator.create({
        sourceLanguage: "en",
        targetLanguage: target,
        monitor(m: { addEventListener: (e: string, cb: (ev: { loaded: number; total: number }) => void) => void }) {
          m.addEventListener("downloadprogress", () => {});
        },
      })) as TranslatorInstance;
      this.translators[target] = instance;
      return instance;
    } catch (e) {
      console.warn(`Translator en→${target} not available:`, e);
      return null;
    }
  }

  /** Traduz texto do inglês para o idioma alvo (pt ou it). */
  async translateTo(text: string, target: TranslationTarget): Promise<string> {
    try {
      await this.initialize();
    } catch (e) {
      console.warn("Translation init skipped:", e);
      return text;
    }

    const translator = await this.getTranslator(target);
    if (!translator) return text;

    try {
      if (this.languageDetector) {
        const detectionResults = await this.languageDetector.detect(text);
        const detected = detectionResults?.[0]?.detectedLanguage;
        if (detected === target || detected === (target === "pt" ? "pt-BR" : "it")) return text;
      }
      const stream = translator.translateStreaming(text);
      let translated = "";
      for await (const chunk of stream) {
        translated += chunk;
      }
      return translated.trim() || text;
    } catch (error) {
      console.error("Translation error:", error);
      return text;
    }
  }

  /** Mantido por compatibilidade: traduz para português. */
  async translateToPortuguese(text: string): Promise<string> {
    return this.translateTo(text, "pt");
  }
}
