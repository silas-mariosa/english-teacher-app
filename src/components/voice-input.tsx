"use client"

import { useState, useRef } from "react"
import { Mic, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SpeechService } from "@/lib/services/speechService"

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  /** Código do idioma para reconhecimento de voz (ex: "en-US", "pt-BR", "it-IT") */
  lang?: string
  /** Chamado ao iniciar a gravação (ex.: para limpar o campo) */
  onRecordingStart?: () => void
  /** Chamado em tempo real com o texto conforme a pessoa fala */
  onInterimTranscript?: (text: string) => void
}

export function VoiceInput({
  onTranscript,
  disabled,
  lang = "en-US",
  onRecordingStart,
  onInterimTranscript,
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const speechServiceRef = useRef<SpeechService | null>(null)
  if (!speechServiceRef.current) speechServiceRef.current = new SpeechService()

  const handleClick = () => {
    const svc = speechServiceRef.current!
    if (isListening) {
      svc.stopListening()
      setIsListening(false)
      return
    }
    onRecordingStart?.()
    setIsListening(true)
    svc.startListening(
      (text) => {
        onTranscript(text)
        setIsListening(false)
      },
      (error) => {
        console.error("Speech recognition error:", error)
        setIsListening(false)
      },
      lang,
      onInterimTranscript
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleClick}
      disabled={disabled}
      className={isListening ? "bg-destructive/20 text-destructive" : ""}
      aria-label={isListening ? "Parar gravação" : "Falar"}
    >
      {isListening ? <Square className="size-4" /> : <Mic className="size-4" />}
    </Button>
  )
}
