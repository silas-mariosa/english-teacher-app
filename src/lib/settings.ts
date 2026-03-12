/**
 * Configurações do app persistidas em JSON no localStorage (banco local).
 * Chave: english-teacher-settings
 */

export type SpeakLang = "en" | "pt" | "it"
export type ListenLang = "en" | "pt" | "it"

export interface AppSettings {
  speakLang: SpeakLang
  listenLang: ListenLang
  temperature: number
  topK: number
  /** Número de pares pergunta/resposta usados como contexto para a IA (1–50). */
  contextMessagesCount: number
}

const STORAGE_KEY = "english-teacher-settings"
const CONTEXT_MIN = 1
const CONTEXT_MAX = 50
const CONTEXT_DEFAULT = 10

const DEFAULT_SETTINGS: AppSettings = {
  speakLang: "en",
  listenLang: "pt",
  temperature: 0.5,
  topK: 40,
  contextMessagesCount: CONTEXT_DEFAULT,
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      speakLang: validSpeakLang(parsed.speakLang) ?? DEFAULT_SETTINGS.speakLang,
      listenLang: validListenLang(parsed.listenLang) ?? DEFAULT_SETTINGS.listenLang,
      temperature:
        typeof parsed.temperature === "number" && parsed.temperature >= 0 && parsed.temperature <= 2
          ? parsed.temperature
          : DEFAULT_SETTINGS.temperature,
      topK:
        typeof parsed.topK === "number" && parsed.topK >= 1 && parsed.topK <= 200
          ? Math.round(parsed.topK)
          : DEFAULT_SETTINGS.topK,
      contextMessagesCount:
        typeof parsed.contextMessagesCount === "number" &&
        parsed.contextMessagesCount >= CONTEXT_MIN &&
        parsed.contextMessagesCount <= CONTEXT_MAX
          ? Math.round(parsed.contextMessagesCount)
          : DEFAULT_SETTINGS.contextMessagesCount,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function validSpeakLang(v: unknown): SpeakLang | null {
  return v === "en" || v === "pt" || v === "it" ? v : null
}

function validListenLang(v: unknown): ListenLang | null {
  return v === "en" || v === "pt" || v === "it" ? v : null
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.warn("Failed to save settings:", e)
  }
}

/** Rótulos para exibição */
export const SPEAK_LANG_LABELS: Record<SpeakLang, string> = {
  en: "Inglês",
  pt: "Português",
  it: "Italiano",
}

export const LISTEN_LANG_LABELS: Record<ListenLang, string> = {
  en: "Inglês",
  pt: "Português",
  it: "Italiano",
}

/** Códigos para STT/TTS (Web Speech API) */
export const LANG_TO_SPEECH_CODE: Record<SpeakLang | ListenLang, string> = {
  en: "en-US",
  pt: "pt-BR",
  it: "it-IT",
}

export { CONTEXT_MIN, CONTEXT_MAX, CONTEXT_DEFAULT }
