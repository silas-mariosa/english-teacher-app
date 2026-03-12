"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  AppSettings,
  loadSettings,
  saveSettings,
  SPEAK_LANG_LABELS,
  LISTEN_LANG_LABELS,
  CONTEXT_MIN,
  CONTEXT_MAX,
  CONTEXT_DEFAULT,
  type SpeakLang,
  type ListenLang,
} from "@/lib/settings"

interface WelcomeSettingsProps {
  onStart: (settings: AppSettings) => void
  onCheckModelReady: () => Promise<string[] | null>
  modelParams?: { maxTemperature: number; maxTopK: number } | null
}

export function WelcomeSettings({ onStart, onCheckModelReady, modelParams }: WelcomeSettingsProps) {
  const [speakLang, setSpeakLang] = useState<SpeakLang>("en")
  const [listenLang, setListenLang] = useState<ListenLang>("pt")
  const [temperature, setTemperature] = useState(0.5)
  const [topK, setTopK] = useState(40)
  const [contextMessagesCount, setContextMessagesCount] = useState(CONTEXT_DEFAULT)
  const [startError, setStartError] = useState<string[] | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    const saved = loadSettings()
    setSpeakLang(saved.speakLang)
    setListenLang(saved.listenLang)
    setTemperature(saved.temperature)
    setTopK(saved.topK)
    setContextMessagesCount(saved.contextMessagesCount)
  }, [])

  const handleStart = async () => {
    setStartError(null)
    setIsChecking(true)
    try {
      const errs = await onCheckModelReady()
      if (errs?.length) {
        setStartError(errs)
        return
      }
      const settings: AppSettings = {
        speakLang,
        listenLang,
        temperature,
        topK,
        contextMessagesCount,
      }
      saveSettings(settings)
      onStart(settings)
    } finally {
      setIsChecking(false)
    }
  }

  const maxTemp = modelParams?.maxTemperature ?? 2
  const maxK = modelParams?.maxTopK ?? 100

  const sectionLabel = "text-sm font-medium text-zinc-200"
  const hint = "text-xs text-zinc-500"
  const sliderClass =
    "w-full h-2 rounded-full bg-zinc-700 cursor-pointer accent-emerald-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:cursor-pointer"

  return (
    <div className="dark w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
      <div className="border-b border-zinc-800 px-6 py-5">
        <h1 className="text-xl font-semibold text-zinc-100">
          Professor de Inglês com IA
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Escolha o idioma para falar e para escutar as respostas. As configurações são salvas localmente.
        </p>
      </div>

      <div className="space-y-6 px-6 py-5">
        {startError && startError.length > 0 && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-200">
            {startError.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <Label htmlFor="speak-lang" className={sectionLabel}>
            Idioma para falar
          </Label>
          <div className="flex flex-wrap gap-2">
            {(["en", "pt", "it"] as const).map((lang) => (
              <Button
                key={lang}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSpeakLang(lang)}
                className={
                  speakLang === lang
                    ? "border-emerald-600 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 hover:text-emerald-300"
                    : "border-zinc-600 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 hover:text-zinc-100"
                }
              >
                {SPEAK_LANG_LABELS[lang]}
              </Button>
            ))}
          </div>
          <p className={hint}>
            Idioma usado ao digitar ou falar no microfone.
          </p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="listen-lang" className={sectionLabel}>
            Idioma para escutar
          </Label>
          <div className="flex flex-wrap gap-2">
            {(["en", "pt", "it"] as const).map((lang) => (
              <Button
                key={lang}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setListenLang(lang)}
                className={
                  listenLang === lang
                    ? "border-emerald-600 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 hover:text-emerald-300"
                    : "border-zinc-600 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 hover:text-zinc-100"
                }
              >
                {LISTEN_LANG_LABELS[lang]}
              </Button>
            ))}
          </div>
          <p className={hint}>
            Idioma da resposta e do áudio (a IA pode responder já nesse idioma).
          </p>
        </div>

        {modelParams && (
          <div className="rounded-lg border border-zinc-700/80 bg-zinc-800/50 p-4 space-y-4">
            <p className="text-sm font-medium text-zinc-200">
              Parâmetros do modelo (opcional)
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label htmlFor="welcome-temperature" className="text-zinc-300">
                    Temperature
                  </Label>
                  <span className="text-zinc-400 tabular-nums">{temperature.toFixed(1)}</span>
                </div>
                <input
                  id="welcome-temperature"
                  type="range"
                  min={0}
                  max={maxTemp}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className={sliderClass}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label htmlFor="welcome-topK" className="text-zinc-300">
                    Top K
                  </Label>
                  <span className="text-zinc-400 tabular-nums">{topK}</span>
                </div>
                <input
                  id="welcome-topK"
                  type="range"
                  min={1}
                  max={maxK}
                  step={1}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className={sliderClass}
                />
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-zinc-700/80 bg-zinc-800/50 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <Label htmlFor="welcome-context" className="text-zinc-300">
              Contexto da conversa (perguntas/respostas)
            </Label>
            <span className="text-zinc-400 tabular-nums">{contextMessagesCount}</span>
          </div>
          <input
            id="welcome-context"
            type="range"
            min={CONTEXT_MIN}
            max={CONTEXT_MAX}
            step={1}
            value={contextMessagesCount}
            onChange={(e) => setContextMessagesCount(Number(e.target.value))}
            className={sliderClass}
          />
          <p className={hint}>
            Quantas das últimas perguntas e respostas a IA usa como contexto (estilo ChatGPT). De {CONTEXT_MIN} a {CONTEXT_MAX}.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleStart}
          disabled={isChecking}
          className="w-full bg-emerald-600 text-white hover:bg-emerald-500 sm:w-auto sm:min-w-[180px]"
        >
          {isChecking ? "Verificando..." : "Iniciar conversa"}
        </Button>
      </div>
    </div>
  )
}
