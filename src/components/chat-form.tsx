"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { chatSchema, type ChatFormValues } from "@/schemas/chat-schema"
import {
  Settings,
  PanelLeftClose,
  PenSquare,
  Search,
  ArrowUp,
  User,
  MoreVertical,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { AIService } from "@/lib/services/aiService"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { VoiceInput } from "@/components/voice-input"
import { ResponseTextWithAudio } from "@/components/response-text-with-audio"
import { LISTEN_LANG_LABELS, LANG_TO_SPEECH_CODE, type AppSettings } from "@/lib/settings"
import {
  loadConversations,
  saveConversation,
  createConversation,
  deleteConversation,
  getContextMessages,
  type Conversation,
  type ChatMessage,
} from "@/lib/conversations"

type ModelParams = {
  maxTemperature: number
  maxTopK: number
}

interface ChatFormProps {
  aiService: AIService
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
  onBackToWelcome?: () => void
  modelParams: ModelParams | null
}

function truncateTitle(text: string, maxLen = 36): string {
  const t = text.trim()
  if (t.length <= maxLen) return t || "Nova conversa"
  return t.slice(0, maxLen).trim() + "…"
}

export function ChatForm({
  aiService,
  settings,
  onSettingsChange,
  onBackToWelcome,
  modelParams,
}: ChatFormProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchChats, setSearchChats] = useState("")
  const [responseEnglish, setResponseEnglish] = useState("")
  const [responseTranslated, setResponseTranslated] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [errors, setErrors] = useState<string[] | null>(null)
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0)
  const [voiceStopTrigger, setVoiceStopTrigger] = useState(0)
  const [responsePanelCollapsed, setResponsePanelCollapsed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const temperature = settings.temperature
  const topK = settings.topK
  const speakLang = settings.speakLang
  const listenLang = settings.listenLang
  const responseLang = listenLang
  const contextMessagesCount = settings.contextMessagesCount

  useEffect(() => {
    setConversations(loadConversations())
  }, [])

  useEffect(() => {
    aiService.checkRequirements().then((errs) => {
      if (errs) setErrors(errs)
      else setErrors(null)
    })
  }, [aiService])

  const form = useForm<ChatFormValues>({
    resolver: zodResolver(chatSchema),
    defaultValues: { message: "" },
  })

  const setMessageFromVoice = useCallback(
    (text: string) => form.setValue("message", text),
    [form]
  )
  const clearMessage = useCallback(() => form.setValue("message", ""), [form])

  const handleNewConversation = useCallback(() => {
    const conv = createConversation()
    setActiveConversation(conv)
    saveConversation(conv)
    setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)])
    setResponseEnglish("")
    setResponseTranslated("")
  }, [])

  const handleSelectConversation = useCallback((conv: Conversation) => {
    setActiveConversation(conv)
    setResponseEnglish("")
    setResponseTranslated("")
  }, [])

  const handleDeleteConversation = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      deleteConversation(id)
      setConversations(loadConversations())
      if (activeConversation?.id === id) {
        setActiveConversation(null)
        setResponseEnglish("")
        setResponseTranslated("")
      }
    },
    [activeConversation?.id]
  )

  const filteredConversations = searchChats.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchChats.toLowerCase())
      )
    : conversations

  const currentMessages = activeConversation?.messages ?? []

  const onSubmit = async (values: ChatFormValues) => {
    if (!values.message.trim()) return

    let conv = activeConversation
    if (!conv) {
      conv = createConversation()
      saveConversation(conv)
      setActiveConversation(conv)
      setConversations((prev) => [conv!, ...prev])
    }

    const userContent = values.message.trim()
    setVoiceStopTrigger((t) => t + 1)
    setIsGenerating(true)
    setStatusMessage("Processando...")
    setResponseEnglish("")
    setResponseTranslated("")

    const updatedMessages: ChatMessage[] = [
      ...conv.messages,
      { role: "user", content: userContent },
    ]
    const isFirstMessage = conv.messages.length === 0
    if (isFirstMessage) {
      conv.title = truncateTitle(userContent)
      saveConversation({ ...conv, messages: updatedMessages })
      setActiveConversation({ ...conv, messages: updatedMessages })
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...conv, messages: updatedMessages } : c))
      )
    }

    try {
      setStatusMessage("")
      let fullResponse = ""
      const context = getContextMessages(conv.messages, contextMessagesCount)
      await aiService.ensureAvailable()

      for await (const chunk of aiService.createSession(
        userContent,
        temperature,
        topK,
        null,
        responseLang,
        context
      )) {
        if (aiService.isAborted()) break
        fullResponse += chunk
        setResponseEnglish(fullResponse.replace(/😊/g, ""))
      }

      fullResponse = fullResponse.replace(/😊/g, "")

      if (fullResponse && !aiService.isAborted()) {
        setResponseTranslated(fullResponse)
        setAutoPlayTrigger(Date.now())
        const finalMessages: ChatMessage[] = [
          ...updatedMessages,
          { role: "model", content: fullResponse },
        ]
        const updated = { ...conv, messages: finalMessages }
        saveConversation(updated)
        setActiveConversation(updated)
        setConversations((prev) =>
          prev.map((c) => (c.id === conv!.id ? updated : c))
        )
      }
    } catch (error) {
      setStatusMessage(`Erro: ${(error as Error).message}`)
      if (isFirstMessage) {
        const reverted = { ...conv, messages: conv.messages }
        saveConversation(reverted)
        setActiveConversation(reverted)
      }
    }

    setIsGenerating(false)
    form.setValue("message", "")
  }

  const handleStop = () => {
    aiService.abort()
    setIsGenerating(false)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [currentMessages, responseEnglish])

  const hasMessages = currentMessages.length > 0 || responseEnglish

  return (
    <div className="dark flex h-screen w-full bg-zinc-950 text-zinc-100">
      {/* Sidebar estilo ChatGPT */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 transition-[width] duration-200 ease-out overflow-hidden`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1 p-2">
            {onBackToWelcome && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={onBackToWelcome}
                aria-label="Configurações"
              >
                <Settings className="size-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={sidebarOpen ? "Recolher barra" : "Expandir barra"}
            >
              <PanelLeftClose className="size-4" />
            </Button>
          </div>

          {sidebarOpen && (
            <>
              <button
                type="button"
                onClick={handleNewConversation}
                className="mx-2 flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <PenSquare className="size-4 shrink-0" />
                Novo chat
              </button>

              <div className="relative mx-2 mt-2">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar em chats"
                  value={searchChats}
                  onChange={(e) => setSearchChats(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-2 pl-8 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                />
              </div>

              <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
                {filteredConversations.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    onClick={() => handleSelectConversation(c)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSelectConversation(c)
                    }
                    className={`group flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm ${
                      activeConversation?.id === c.id
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
                    }`}
                    tabIndex={0}
                  >
                    <MessageSquare className="size-4 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 truncate" title={c.title}>
                      {c.title}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
                      onClick={(e) => handleDeleteConversation(e, c.id)}
                      aria-label="Excluir conversa"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border-t border-zinc-800 px-3 py-2">
                <p className="truncate text-xs text-zinc-500">
                  Professor de Inglês com IA · {contextMessagesCount} no contexto
                </p>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex min-w-0 flex-1 flex-col bg-zinc-950">
        {/* Top bar */}
        <header className="flex shrink-0 items-center justify-end gap-1 border-b border-zinc-800/50 px-4 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Perfil"
          >
            <User className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Mais opções"
          >
            <MoreVertical className="size-4" />
          </Button>
        </header>

        {/* Conteúdo central: mensagens ou estado vazio */}
        <div className="flex-1 overflow-y-auto">
          {errors && errors.length > 0 && (
            <div className="mx-auto max-w-2xl px-4 py-3">
              <div className="rounded-lg bg-red-950/50 border border-red-900/50 p-4 text-sm text-red-200">
                {errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="mx-auto max-w-2xl px-4 py-2 text-center text-sm text-zinc-500">
              {statusMessage}
            </div>
          )}

          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center px-4 py-16">
              <p className="text-xl text-zinc-400">
                Como posso ajudar?
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Falando em {speakLang === "en" ? "inglês" : speakLang === "pt" ? "português" : "italiano"} · Respostas em {LISTEN_LANG_LABELS[listenLang]}
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
              {currentMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-emerald-700/80 text-white"
                        : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isGenerating && responseEnglish && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl bg-zinc-800 px-4 py-3 text-sm text-zinc-200">
                    {responseEnglish}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Área de acompanhamento da fala / última resposta com áudio — altura máxima e botão ocultar */}
        {(responseTranslated || responseEnglish) && (
          <div className="flex shrink-0 flex-col border-t border-zinc-800/50 bg-zinc-900/50">
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-zinc-800/50">
              <span className="text-sm font-medium text-zinc-400">
                Ouvir resposta
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={() => setResponsePanelCollapsed((c) => !c)}
                aria-label={responsePanelCollapsed ? "Mostrar área de resposta" : "Ocultar área de resposta"}
              >
                {responsePanelCollapsed ? (
                  <>
                    <ChevronDown className="size-4" />
                    Mostrar
                  </>
                ) : (
                  <>
                    <ChevronUp className="size-4" />
                    Ocultar
                  </>
                )}
              </Button>
            </div>
            {!responsePanelCollapsed && (
              <div className="max-h-[280px] overflow-y-auto px-4 py-3">
                <div className="mx-auto max-w-3xl">
                  {responseLang === "en" ? (
                    <ResponseTextWithAudio
                      title=""
                      text={responseEnglish}
                      lang="en-US"
                      disabled={isGenerating}
                      placeholder=""
                      autoPlayTrigger={autoPlayTrigger}
                    />
                  ) : (
                    <ResponseTextWithAudio
                      title=""
                      text={responseTranslated}
                      lang={LANG_TO_SPEECH_CODE[responseLang]}
                      disabled={isGenerating}
                      placeholder=""
                      autoPlayTrigger={autoPlayTrigger}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Barra de input fixa na parte inferior (estilo ChatGPT) */}
        <div className="shrink-0 border-t border-zinc-800/50 px-4 py-4">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex items-end gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                aria-label="Anexar"
              >
                +
              </Button>
              <Textarea
                {...form.register("message")}
                placeholder="Pergunte alguma coisa..."
                rows={1}
                disabled={isGenerating}
                className="min-h-[44px] max-h-32 flex-1 resize-none border-0 bg-transparent py-3 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    form.handleSubmit(onSubmit)()
                  }
                }}
              />
              <div className="flex shrink-0 items-center gap-0.5 [&_button]:h-9 [&_button]:w-9 [&_button]:rounded-full [&_button]:border-zinc-600 [&_button]:text-zinc-300 [&_button]:hover:bg-zinc-700 [&_button]:hover:text-zinc-100">
                <VoiceInput
                  onTranscript={setMessageFromVoice}
                  onRecordingStart={clearMessage}
                  onInterimTranscript={setMessageFromVoice}
                  disabled={isGenerating}
                  lang={LANG_TO_SPEECH_CODE[speakLang]}
                  stopTrigger={voiceStopTrigger}
                />
                {isGenerating ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-red-600/20 text-red-400 hover:bg-red-600/30"
                    onClick={handleStop}
                    aria-label="Parar"
                  >
                    ■
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
                    disabled={!form.watch("message")?.trim()}
                    aria-label="Enviar"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                )}
              </div>
            </form>
            {form.formState.errors.message && (
              <p className="mt-1 text-xs text-red-400">
                {form.formState.errors.message.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
