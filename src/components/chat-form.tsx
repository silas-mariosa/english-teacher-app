"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { chatSchema, type ChatFormValues } from "@/schemas/chat-schema"
import { AIService } from "@/lib/services/aiService"
import { TranslationService } from "@/lib/services/translationService"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { VoiceInput } from "@/components/voice-input"
import { ResponseTextWithAudio } from "@/components/response-text-with-audio"
import { saveSettings, LISTEN_LANG_LABELS, LANG_TO_SPEECH_CODE, type AppSettings } from "@/lib/settings"

type ModelParams = {
  maxTemperature: number
  maxTopK: number
}

interface ChatFormProps {
  /** Mesma instância de AIService usada na tela de boas-vindas (evita erro "unable to create session") */
  aiService: AIService
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
  onBackToWelcome?: () => void
  modelParams: ModelParams | null
}

export function ChatForm({ aiService, settings, onSettingsChange, onBackToWelcome, modelParams }: ChatFormProps) {
  const [responseEnglish, setResponseEnglish] = useState("")
  const [responseTranslated, setResponseTranslated] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [errors, setErrors] = useState<string[] | null>(null)
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0)

  const temperature = settings.temperature
  const topK = settings.topK
  const speakLang = settings.speakLang
  const listenLang = settings.listenLang

  const translationServiceRef = useRef<TranslationService | null>(null)
  if (!translationServiceRef.current) translationServiceRef.current = new TranslationService()
  const translationService = translationServiceRef.current

  useEffect(() => {
    aiService.checkRequirements().then((errs) => {
      if (errs) setErrors(errs)
      else setErrors(null)
    })
  }, [aiService])

  const persistSettings = useCallback(
    (next: Partial<AppSettings>) => {
      const updated = { ...settings, ...next }
      saveSettings(updated)
      onSettingsChange(updated)
    },
    [settings, onSettingsChange]
  )

  const form = useForm<ChatFormValues>({
    resolver: zodResolver(chatSchema),
    defaultValues: { message: "" },
  })

  const setMessageFromVoice = useCallback(
    (text: string) => {
      form.setValue("message", text)
    },
    [form]
  )

  const clearMessage = useCallback(() => {
    form.setValue("message", "")
  }, [form])

  const onSubmit = async (values: ChatFormValues) => {
    if (!values.message.trim()) return

    setIsGenerating(true)
    setStatusMessage("Processando sua pergunta...")
    setResponseEnglish("")
    setResponseTranslated("")

    try {
      setStatusMessage("")
      let fullResponse = ""

      // API do Chrome exige verificação de availability() imediatamente antes de createSession
      await aiService.ensureAvailable()

      for await (const chunk of aiService.createSession(
        values.message.trim(),
        temperature,
        topK,
        null
      )) {
        if (aiService.isAborted()) break
        fullResponse += chunk
        setResponseEnglish(fullResponse)
      }

      if (fullResponse && !aiService.isAborted()) {
        if (listenLang === "en") {
          setResponseTranslated(fullResponse)
        } else {
          setStatusMessage("Traduzindo resposta...")
          try {
            await translationService.initialize()
            const translated = await translationService.translateTo(fullResponse, listenLang)
            setResponseTranslated(translated)
          } catch (err) {
            console.warn("Tradução indisponível, exibindo em inglês:", err)
            setResponseTranslated(fullResponse)
          }
          setStatusMessage("")
        }
        setAutoPlayTrigger(Date.now())
      }
    } catch (error) {
      setStatusMessage(`Erro: ${(error as Error).message}`)
    }

    setIsGenerating(false)
  }

  const handleStop = () => {
    aiService.abort()
    setIsGenerating(false)
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Professor de Inglês com IA</CardTitle>
            <CardDescription>
              Falando em {settings.speakLang === "en" ? "inglês" : settings.speakLang === "pt" ? "português" : "italiano"} · Escutando em {LISTEN_LANG_LABELS[listenLang]}.
            </CardDescription>
          </div>
          {onBackToWelcome && (
            <Button type="button" variant="ghost" size="sm" onClick={onBackToWelcome}>
              Alterar idiomas
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {errors && (
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            {errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}



        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Sua mensagem</Label>
            <div className="flex gap-2">
              <Textarea
                id="message"
                placeholder="Digite ou use o microfone para falar..."
                className="min-h-[120px] resize-y"
                {...form.register("message")}
                disabled={isGenerating}
              />
              <VoiceInput
                onTranscript={setMessageFromVoice}
                onRecordingStart={clearMessage}
                onInterimTranscript={setMessageFromVoice}
                disabled={isGenerating}
                lang={LANG_TO_SPEECH_CODE[speakLang]}
              />
            </div>
            {form.formState.errors.message && (
              <p className="text-sm text-destructive">{form.formState.errors.message.message}</p>
            )}
          </div>

          {isGenerating ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleStop}
            >
              Parar
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!form.watch("message")?.trim()}
            >
              Enviar
            </Button>
          )}
        </form>

        {statusMessage && (
          <div className="rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground">
            {statusMessage}
          </div>
        )}

        {/* Uma única resposta: em inglês se escolheu escutar em inglês, senão no idioma escolhido (ex.: italiano). Auto-play com destaque por palavra. */}
        <div className="space-y-6">
          {listenLang === "en" ? (
            <ResponseTextWithAudio
              title="Resposta em inglês"
              text={responseEnglish}
              lang="en-US"
              disabled={isGenerating}
              placeholder="—"
              autoPlayTrigger={autoPlayTrigger}
            />
          ) : (
            <ResponseTextWithAudio
              title={`Resposta em ${LISTEN_LANG_LABELS[listenLang]}`}
              text={responseTranslated}
              lang={LANG_TO_SPEECH_CODE[listenLang]}
              disabled={isGenerating}
              placeholder={isGenerating ? "Aguarde a tradução..." : "—"}
              autoPlayTrigger={autoPlayTrigger}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
