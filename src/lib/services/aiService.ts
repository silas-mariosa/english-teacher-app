/* Chrome experimental APIs - LanguageModel (Gemini Nano) */
declare global {
  interface Window {
    chrome?: unknown;
    LanguageModel?: {
      availability: (opts: { languages: string[] }) => Promise<string>;
      create: (opts: {
        expectedInputs: Array<{ type: string; languages?: string[] }>;
        expectedOutputs: Array<{ type: string; languages?: string[] }>;
        temperature: number;
        topK: number;
        initialPrompts: Array<{
          role: string;
          content: Array<{ type: string; value: string }>;
        }>;
        monitor?: (m: {
          addEventListener: (
            e: string,
            cb: (ev: { loaded: number; total: number }) => void,
          ) => void;
        }) => void;
      }) => Promise<{
        destroy: () => void;
        promptStreaming: (
          messages: unknown[],
          opts: { signal: AbortSignal },
        ) => Promise<AsyncIterable<string>>;
        prompt: (text: string) => Promise<string>;
      }>;
      params: () => Promise<{
        defaultTemperature: number;
        maxTemperature: number;
        defaultTopK: number;
        maxTopK: number;
      }>;
    };
    Translator?: {
      availability: (opts: {
        sourceLanguage: string;
        targetLanguage: string;
      }) => Promise<string>;
      create: (opts: {
        sourceLanguage: string;
        targetLanguage: string;
        monitor?: (m: {
          addEventListener: (
            e: string,
            cb: (ev: { loaded: number; total: number }) => void,
          ) => void;
        }) => void;
      }) => Promise<{
        translateStreaming: (text: string) => AsyncIterable<string>;
      }>;
    };
    LanguageDetector?: {
      create: () => Promise<{
        detect: (text: string) => Promise<Array<{ detectedLanguage: string }>>;
      }>;
    };
  }
}

export class AIService {
  private session: Awaited<
    ReturnType<NonNullable<typeof window.LanguageModel>["create"]>
  > | null = null;
  private abortController: AbortController | null = null;

  async checkRequirements(): Promise<string[] | null> {
    const errors: string[] = [];

    const isChrome =
      typeof window !== "undefined" &&
      !!(window as { chrome?: unknown }).chrome;
    if (!isChrome) {
      errors.push(
        "⚠️ Este recurso só funciona no Google Chrome ou Chrome Canary (versão recente).",
      );
    }

    if (
      typeof window === "undefined" ||
      !("LanguageModel" in window) ||
      !window.LanguageModel
    ) {
      errors.push("⚠️ As APIs nativas de IA não estão ativas.");
      errors.push("Ative a seguinte flag em chrome://flags/:");
      errors.push(
        "- Prompt API for Gemini Nano (chrome://flags/#prompt-api-for-gemini-nano)",
      );
      errors.push("Depois reinicie o Chrome e tente novamente.");
      return errors;
    }

    if ("Translator" in window && window.Translator) {
      const translatorAvailability = await window.Translator.availability({
        sourceLanguage: "en",
        targetLanguage: "pt",
      });
      console.log("Translator Availability:", translatorAvailability);
      if (translatorAvailability === "no") {
        errors.push(
          "⚠️ Tradução de inglês para português não está disponível.",
        );
      }
    } else {
      errors.push("⚠️ A API de Tradução não está ativa.");
      errors.push("Ative a seguinte flag em chrome://flags/:");
      errors.push("- Translation API (chrome://flags/#translation-api)");
    }

    if (!("LanguageDetector" in window)) {
      errors.push("⚠️ A API de Detecção de Idioma não está ativa.");
      errors.push("Ative a seguinte flag em chrome://flags/:");
      errors.push(
        "- Language Detection API (chrome://flags/#language-detector-api)",
      );
    }

    if (errors.length > 0) {
      return errors;
    }

    const availability = await window.LanguageModel!.availability({
      languages: ["en"],
    });
    console.log("Language Model Availability:", availability);

    if (availability === "available") {
      return null;
    }

    if (availability === "unavailable") {
      errors.push(
        "⚠️ O modelo de IA (Gemini Nano) está indisponível neste dispositivo.",
      );
      errors.push("Possíveis causas:");
      errors.push("• Requisitos: 16 GB RAM, 4+ núcleos de CPU (ou GPU com 4+ GB VRAM), ~2 GB livres em disco.");
      errors.push("• Celular/tablet: o modelo não é suportado em dispositivos móveis.");
      errors.push("• Ative também: chrome://flags/#optimization-guide-on-device-model");
      errors.push("• Verifique o status em: chrome://on-device-internals");
    }

    if (availability === "downloading") {
      errors.push(
        "⚠️ O modelo de linguagem de IA está sendo baixado. Por favor, aguarde alguns minutos e tente novamente.",
      );
    }

    if (availability === "downloadable") {
      errors.push(
        "⚠️ O modelo de linguagem de IA precisa ser baixado, baixando agora...",
      );
      try {
        const session = await window.LanguageModel!.create({
          expectedInputs: [
            { type: "text", languages: ["en"] },
            { type: "audio" },
            { type: "image" },
          ],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
          temperature: 0.5,
          topK: 40,
          initialPrompts: [],
          monitor(m) {
            m.addEventListener(
              "downloadprogress",
              (e: { loaded: number; total: number }) => {
                const percent = ((e.loaded / e.total) * 100).toFixed(0);
                console.log(`Downloaded ${percent}%`);
              },
            );
          },
        });
        await session.prompt("Hello");
        session.destroy();
        const newAvailability = await window.LanguageModel!.availability({
          languages: ["en"],
        });
        if (newAvailability === "available") {
          return null;
        }
      } catch (error) {
        console.error("Error downloading model:", error);
        errors.push(`⚠️ Erro ao baixar o modelo: ${(error as Error).message}`);
      }
    }

    return errors.length > 0 ? errors : null;
  }

  async getParams() {
    if (typeof window === "undefined" || !window.LanguageModel)
      return {
        defaultTemperature: 0.5,
        maxTemperature: 2,
        defaultTopK: 40,
        maxTopK: 100,
      };
    const params = await window.LanguageModel.params();
    console.log("Language Model Params:", params);
    return params;
  }

  /**
   * Verifica disponibilidade e lança se o modelo não estiver pronto.
   * Chamar logo antes de createSession() para satisfazer a API do Chrome.
   */
  async ensureAvailable(): Promise<void> {
    if (typeof window === "undefined" || !window.LanguageModel) {
      throw new Error("Modelo de IA não disponível neste ambiente.");
    }
    const availability = await window.LanguageModel.availability({ languages: ["en"] });
    if (availability !== "available") {
      if (availability === "unavailable") {
        throw new Error(
          "O modelo de IA não está disponível neste dispositivo. Tente em outro computador ou verifique as flags do Chrome.",
        );
      }
      if (availability === "downloading") {
        throw new Error(
          "O modelo ainda está sendo baixado. Aguarde alguns minutos e tente novamente.",
        );
      }
      if (availability === "downloadable") {
        throw new Error(
          "O modelo precisa ser baixado. Feche outras abas, recarregue a página e aguarde o download iniciar.",
        );
      }
      throw new Error("O modelo de IA não está pronto. Status: " + availability);
    }
  }

  async *createSession(
    question: string,
    temperature: number,
    topK: number,
    file: File | null = null,
  ): AsyncGenerator<string> {
    if (typeof window === "undefined" || !window.LanguageModel) return;

    this.abortController?.abort();
    this.abortController = new AbortController();

    if (this.session) {
      this.session.destroy();
    }

    this.session = await window.LanguageModel.create({
      expectedInputs: [
        { type: "text", languages: ["en"] },
        { type: "audio" },
        { type: "image" },
      ],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      temperature,
      topK,
      initialPrompts: [
        {
          role: "system",
          content: [
            {
              type: "text",
              value: `You are an English teacher AI assistant. Help students practice and improve their English.
- Respond clearly and pedagogically.
- Correct mistakes gently when relevant.
- Use plain text format, no markdown.
- Keep responses concise for conversation flow.`,
            },
          ],
        },
      ],
    });

    const contentArray: Array<{ type: string; value: string | Blob }> = [
      { type: "text", value: question },
    ];

    if (file) {
      const fileType = file.type.split("/")[0];
      if (fileType === "image" || fileType === "audio") {
        const blob = new Blob([await file.arrayBuffer()], { type: file.type });
        contentArray.push({ type: fileType, value: blob });
        console.log(`Adding ${fileType} to prompt:`, file.name);
      }
    }

    const responseStream = await this.session.promptStreaming(
      [{ role: "user", content: contentArray }],
      { signal: this.abortController.signal },
    );

    for await (const chunk of responseStream) {
      if (this.abortController.signal.aborted) break;
      yield chunk;
    }
  }

  abort() {
    this.abortController?.abort();
  }

  isAborted() {
    return this.abortController?.signal.aborted ?? false;
  }
}
