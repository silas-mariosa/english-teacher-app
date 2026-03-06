"use client"

import { useRef } from "react"
import { Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SpeechService } from "@/lib/services/speechService"

interface AudioOutputProps {
  text: string
  lang?: "pt-BR" | "en-US"
  disabled?: boolean
}

export function AudioOutput({ text, lang = "pt-BR", disabled }: AudioOutputProps) {
  const speechServiceRef = useRef<SpeechService | null>(null)
  if (!speechServiceRef.current) speechServiceRef.current = new SpeechService()

  const handlePlay = () => {
    if (!text.trim()) return
    speechServiceRef.current!.speak(text, lang)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handlePlay}
      disabled={disabled || !text.trim()}
      aria-label="Ouvir resposta"
    >
      <Volume2 className="size-4" />
    </Button>
  )
}
