"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AppSettings,
  loadSettings,
  saveSettings,
  SPEAK_LANG_LABELS,
  LISTEN_LANG_LABELS,
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
  const [startError, setStartError] = useState<string[] | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    const saved = loadSettings()
    setSpeakLang(saved.speakLang)
    setListenLang(saved.listenLang)
    setTemperature(saved.temperature)
    setTopK(saved.topK)
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
      }
      saveSettings(settings)
      onStart(settings)
    } finally {
      setIsChecking(false)
    }
  }

  const maxTemp = modelParams?.maxTemperature ?? 2
  const maxK = modelParams?.maxTopK ?? 100

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Professor de Inglês com IA</CardTitle>
        <CardDescription>
          Escolha o idioma em que deseja falar e o idioma em que deseja escutar as respostas. As
          configurações são salvas localmente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base font-medium">Idioma para falar</Label>
          <div className="flex flex-wrap gap-2">
            {(["en", "pt", "it"] as const).map((lang) => (
              <Button
                key={lang}
                type="button"
                variant={speakLang === lang ? "default" : "outline"}
                size="sm"
                onClick={() => setSpeakLang(lang)}
              >
                {SPEAK_LANG_LABELS[lang]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Idioma usado ao digitar ou falar no microfone.
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-medium">Idioma para escutar</Label>
          <div className="flex flex-wrap gap-2">
            {(["en", "pt", "it"] as const).map((lang) => (
              <Button
                key={lang}
                type="button"
                variant={listenLang === lang ? "default" : "outline"}
                size="sm"
                onClick={() => setListenLang(lang)}
              >
                {LISTEN_LANG_LABELS[lang]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Idioma da tradução e do áudio da resposta (a IA responde em inglês e traduzimos para
            este idioma).
          </p>
        </div>

        {modelParams && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <p className="text-sm font-medium">Parâmetros do modelo (opcional)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label htmlFor="welcome-temperature">Temperature</Label>
                  <span className="text-muted-foreground">{temperature.toFixed(1)}</span>
                </div>
                <input
                  id="welcome-temperature"
                  type="range"
                  min={0}
                  max={maxTemp}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label htmlFor="welcome-topK">Top K</Label>
                  <span className="text-muted-foreground">{topK}</span>
                </div>
                <input
                  id="welcome-topK"
                  type="range"
                  min={1}
                  max={maxK}
                  step={1}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
                />
              </div>
            </div>
          </div>
        )}

        <Button type="button" onClick={handleStart} className="w-full sm:w-auto">
          Iniciar conversa
        </Button>
      </CardContent>
    </Card>
  )
}
