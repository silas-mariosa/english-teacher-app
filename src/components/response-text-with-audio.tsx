"use client"

import { useState, useRef, useMemo, useEffect } from "react"
import { Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SpeechService } from "@/lib/services/speechService"
import { cn } from "@/lib/utils"

interface ResponseTextWithAudioProps {
  /** Título exibido acima do bloco (ex: "Resposta em inglês") */
  title: string
  text: string
  lang?: string
  disabled?: boolean
  /** Conteúdo exibido quando não há texto (ex: "—" ou "Aguarde a tradução...") */
  placeholder?: string
  /** Quando definido, inicia a reprodução com destaque por palavra (ex.: após gerar resposta) */
  autoPlayTrigger?: number
}

/** Remove asteriscos de markdown (** negrito, * lista) para exibição e áudio */
function stripMarkdownAsterisks(text: string): string {
  if (!text.trim()) return text
  return (
    text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^\s*\*\s+/gm, "• ")
      .trim()
  )
}

/** Separa o texto em segmentos: palavras, espaços e quebras de linha (preserva layout) */
function getSegments(text: string): { type: "word" | "space" | "newline"; value: string }[] {
  if (!text.trim()) return []
  const segments: { type: "word" | "space" | "newline"; value: string }[] = []
  const regex = /\S+|\n|[^\S\n]+/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const value = match[0]
    if (value === "\n") {
      segments.push({ type: "newline", value: "\n" })
    } else if (/^\S+$/.test(value)) {
      segments.push({ type: "word", value })
    } else {
      segments.push({ type: "space", value })
    }
  }
  return segments
}

/** Apenas as palavras na ordem (para índice no highlight) */
function getWords(text: string): string[] {
  return text.trim() ? text.match(/\S+/g) ?? [] : []
}

export function ResponseTextWithAudio({
  title,
  text,
  lang,
  disabled,
  placeholder = "—",
  autoPlayTrigger,
}: ResponseTextWithAudioProps) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const speechRef = useRef<SpeechService | null>(null)
  const lastAutoPlayRef = useRef<number>(0)
  if (!speechRef.current) speechRef.current = new SpeechService()

  const speechLang = lang ?? "pt-BR"
  const cleanedText = useMemo(() => stripMarkdownAsterisks(text), [text])
  const words = useMemo(() => getWords(cleanedText), [cleanedText])
  const segments = useMemo(() => getSegments(cleanedText), [cleanedText])
  const isEmpty = !cleanedText.trim()

  const handlePlayAll = () => {
    if (isEmpty) return
    speechRef.current!.speakWithHighlights(
      cleanedText,
      speechLang,
      (index) => setHighlightedIndex(index >= 0 ? index : null),
      () => setHighlightedIndex(null)
    )
  }

  useEffect(() => {
    if (!autoPlayTrigger || autoPlayTrigger === lastAutoPlayRef.current || !cleanedText.trim()) return
    lastAutoPlayRef.current = autoPlayTrigger
    speechRef.current?.speakWithHighlights(
      cleanedText,
      speechLang,
      (index) => setHighlightedIndex(index >= 0 ? index : null),
      () => setHighlightedIndex(null)
    )
  }, [autoPlayTrigger, cleanedText, speechLang])

  const handleWordClick = (word: string) => {
    if (disabled) return
    speechRef.current!.speak(word, speechLang)
  }

  if (isEmpty) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-medium leading-none shrink-0" aria-label={title}>
            {title}
          </p>
          <span className="text-xs text-muted-foreground shrink-0">—</span>
        </div>
        <div className="rounded-lg border-2 border-muted bg-muted/30 p-4 text-sm text-muted-foreground min-h-[80px]">
          {placeholder}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-medium leading-none shrink-0" aria-label={title}>
          {title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handlePlayAll}
          disabled={disabled}
          aria-label="Ouvir texto completo"
          className="h-8 w-8 shrink-0"
        >
          <Volume2 className="size-4" />
        </Button>
      </div>
      <div
        className={cn(
          "rounded-lg border-2 border-muted bg-muted/30 p-4 text-sm min-h-[80px]",
          "leading-relaxed select-text"
        )}
      >
        {(() => {
          let wordIndex = 0
          return segments.map((seg, i) => {
            if (seg.type === "newline") {
              return <br key={i} />
            }
            if (seg.type === "space") {
              return <span key={i}>{seg.value}</span>
            }
            const currentIndex = wordIndex
            wordIndex++
            const word = seg.value
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleWordClick(word)}
                className={cn(
                  "rounded px-0.5 py-0.5 cursor-pointer align-baseline",
                  "hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1",
                  highlightedIndex === currentIndex &&
                    "bg-primary/30 text-primary-foreground font-medium"
                )}
                aria-label={`Ouvir: ${word}`}
              >
                {word}
              </button>
            )
          })
        })()}
      </div>
    </div>
  )
}
