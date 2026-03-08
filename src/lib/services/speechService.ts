/**
 * SpeechService - TTS e STT usando Web Speech API (gratuita, nativa do browser)
 */

export class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;

  constructor() {
    if (typeof window !== "undefined") {
      this.synthesis = window.speechSynthesis;
    } else {
      this.synthesis = {} as SpeechSynthesis;
    }
  }

  /**
   * Text-to-Speech: reproduz o texto em áudio
   * @param text Texto a ser falado
   * @param lang Idioma (ex: "en-US", "pt-BR")
   */
  speak(text: string, lang: string = "pt-BR"): void {
    if (typeof window === "undefined") return;

    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.pitch = 1;

    // Tenta usar voz em português ou inglês conforme o idioma
    const voices = this.synthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith(lang.split("-")[0]) || v.lang === lang
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    this.synthesis.speak(utterance);
  }

  /**
   * Retorna índices de início de cada palavra no texto (para mapear boundary → palavra)
   */
  private getWordRanges(text: string): { start: number; end: number }[] {
    const ranges: { start: number; end: number }[] = [];
    const regex = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
    return ranges;
  }

  /**
   * TTS com callbacks para destaque por palavra (evento boundary da API).
   * @param onWordBoundary Índice da palavra sendo falada (0-based), ou -1 ao terminar
   * @param onEnd Chamado quando a fala termina
   */
  speakWithHighlights(
    text: string,
    lang: string,
    onWordBoundary: (wordIndex: number) => void,
    onEnd?: () => void
  ): void {
    if (typeof window === "undefined") return;

    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.pitch = 1;

    const voices = this.synthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith(lang.split("-")[0]) || v.lang === lang
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    const wordRanges = this.getWordRanges(text);

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (event.name !== "word") return;
      const charIndex = event.charIndex ?? 0;
      const index = wordRanges.findIndex(
        (r) => charIndex >= r.start && charIndex < r.end
      );
      if (index !== -1) {
        onWordBoundary(index);
      }
    };

    utterance.onend = () => {
      onWordBoundary(-1);
      onEnd?.();
    };

    utterance.onerror = () => {
      onWordBoundary(-1);
      onEnd?.();
    };

    this.synthesis.speak(utterance);
  }

  stop(): void {
    if (typeof window !== "undefined") {
      this.synthesis.cancel();
    }
  }

  isSpeaking(): boolean {
    return typeof window !== "undefined" && this.synthesis.speaking;
  }

  /**
   * Aguarda as vozes carregarem (getVoices retorna vazio inicialmente)
   */
  loadVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      const voices = this.synthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }
      this.synthesis.onvoiceschanged = () => {
        resolve(this.synthesis.getVoices());
      };
    });
  }

  /**
   * Speech-to-Text: inicia reconhecimento de voz
   * @param onResult Callback com o texto final quando a fala termina
   * @param onError Callback de erro (opcional)
   * @param lang Código do idioma (ex: "en-US", "pt-BR", "it-IT")
   * @param onInterimResult Callback com o texto em tempo real (palavras conforme fala)
   */
  startListening(
    onResult: (text: string) => void,
    onError?: (error: string) => void,
    lang: string = "en-US",
    onInterimResult?: (text: string) => void
  ): void {
    if (typeof window === "undefined") return;

    const SpeechRecognitionAPI =
      (window as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      onError?.("Reconhecimento de voz não suportado neste navegador.");
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = lang;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let fullTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      if (onInterimResult) {
        onInterimResult(fullTranscript);
      }
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        onResult(fullTranscript);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      onError?.(event.error);
    };

    this.recognition.start();
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }

  isListening(): boolean {
    return this.recognition !== null;
  }
}
