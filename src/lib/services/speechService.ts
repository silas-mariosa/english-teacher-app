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
   * Retorna uma Promise que resolve com o texto transcrito
   */
  startListening(
    onResult: (text: string) => void,
    onError?: (error: string) => void
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
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      onResult(transcript);
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
