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
import { AudioOutput } from "@/components/audio-output"

export function ChatForm() {
  const [output, setOutput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [errors, setErrors] = useState<string[] | null>(null)

  const aiServiceRef = useRef<AIService | null>(null)
  const translationServiceRef = useRef<TranslationService | null>(null)
  if (!aiServiceRef.current) aiServiceRef.current = new AIService()
  if (!translationServiceRef.current) translationServiceRef.current = new TranslationService()
  const aiService = aiServiceRef.current
  const translationService = translationServiceRef.current

  useEffect(() => {
    aiService.checkRequirements().then((errs) => {
      if (errs) setErrors(errs)
    })
  }, [aiService])

  const form = useForm<ChatFormValues>({
    resolver: zodResolver(chatSchema),
    defaultValues: { message: "" },
  })

  const appendToMessage = useCallback(
    (text: string) => {
      const current = form.getValues("message")
      form.setValue("message", current ? `${current} ${text}` : text)
    },
    [form]
  )

  const onSubmit = async (values: ChatFormValues) => {
    if (!values.message.trim()) return

    setIsGenerating(true)
    setOutput("Processando sua pergunta...")

    try {
      await translationService.initialize()
    } catch (err) {
      console.warn("Translation init skipped:", err)
    }

    try {
      setOutput("")
      let fullResponse = ""
      const params = await aiService.getParams()

      for await (const chunk of aiService.createSession(
        values.message.trim(),
        params.defaultTemperature ?? 0.5,
        params.defaultTopK ?? 40,
        null
      )) {
        if (aiService.isAborted()) break
        fullResponse += chunk
        setOutput(fullResponse)
      }

      if (fullResponse && !aiService.isAborted()) {
        setOutput("Traduzindo resposta...")
        const translated = await translationService.translateToPortuguese(fullResponse)
        setOutput(translated)
      }
    } catch (error) {
      setOutput(`Erro: ${(error as Error).message}`)
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
        <CardTitle>Professor de Inglês com IA</CardTitle>
        <CardDescription>
          Digite ou fale para praticar inglês. A IA responde em texto e você pode ouvir a resposta.
        </CardDescription>
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
                onTranscript={appendToMessage}
                disabled={isGenerating}
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

        {output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Resposta</Label>
              <AudioOutput text={output} lang="pt-BR" />
            </div>
            <div className="rounded-md border bg-muted/50 p-4 text-sm whitespace-pre-wrap">
              {output}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
