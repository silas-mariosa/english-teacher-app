"use client"

import { useState, useEffect, useRef } from "react"
import { ChatForm } from "@/components/chat-form"
import { WelcomeSettings } from "@/components/welcome-settings"
import { AIService } from "@/lib/services/aiService"
import type { AppSettings } from "@/lib/settings"

export default function Home() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [modelParams, setModelParams] = useState<{
    maxTemperature: number
    maxTopK: number
  } | null>(null)
  const aiRef = useRef<AIService | null>(null)
  if (!aiRef.current) aiRef.current = new AIService()

  useEffect(() => {
    aiRef.current!.checkRequirements().then((errs) => {
      if (!errs?.length) {
        aiRef.current!.getParams().then((p) => {
          setModelParams({
            maxTemperature: p.maxTemperature ?? 2,
            maxTopK: p.maxTopK ?? 100,
          })
        })
      }
    })
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <main className="w-full max-w-2xl">
        {settings === null ? (
          <WelcomeSettings
            onStart={setSettings}
            onCheckModelReady={() => aiRef.current!.checkRequirements()}
            modelParams={modelParams}
          />
        ) : (
          <ChatForm
            aiService={aiRef.current}
            settings={settings}
            onSettingsChange={setSettings}
            onBackToWelcome={() => setSettings(null)}
            modelParams={modelParams}
          />
        )}
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          Professor de Inglês com IA — Chrome com Gemini Nano
        </footer>
      </main>
    </div>
  )
}
