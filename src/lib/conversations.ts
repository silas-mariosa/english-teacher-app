/**
 * Conversas persistidas no localStorage (chave: english-teacher-conversations).
 * Cada conversa guarda as mensagens para enviar as últimas N como contexto à IA.
 */

export type MessageRole = "user" | "model"

export interface ChatMessage {
  role: MessageRole
  content: string
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = "english-teacher-conversations"

function loadRaw(): Conversation[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c: unknown): c is Conversation =>
        typeof c === "object" &&
        c !== null &&
        "id" in c &&
        "title" in c &&
        "messages" in c &&
        Array.isArray((c as Conversation).messages)
    )
  } catch {
    return []
  }
}

export function loadConversations(): Conversation[] {
  const list = loadRaw()
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getConversation(id: string): Conversation | null {
  return loadRaw().find((c) => c.id === id) ?? null
}

export function saveConversation(conversation: Conversation): void {
  if (typeof window === "undefined") return
  const list = loadRaw()
  const idx = list.findIndex((c) => c.id === conversation.id)
  const updated = { ...conversation, updatedAt: Date.now() }
  if (idx >= 0) list[idx] = updated
  else list.unshift(updated)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn("Failed to save conversation:", e)
  }
}

export function createConversation(title?: string): Conversation {
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = Date.now()
  return {
    id,
    title: title ?? "Nova conversa",
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function deleteConversation(id: string): void {
  if (typeof window === "undefined") return
  const list = loadRaw().filter((c) => c.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn("Failed to delete conversation:", e)
  }
}

/**
 * Retorna as últimas N mensagens (pares user/model) como lista plana,
 * pronta para enviar como contexto ao modelo. N = contextMessagesCount.
 */
export function getContextMessages(
  messages: ChatMessage[],
  contextMessagesCount: number
): ChatMessage[] {
  if (contextMessagesCount <= 0 || messages.length === 0) return []
  // Cada "par" = 1 user + 1 model; queremos os últimos contextMessagesCount pares
  const pairs = contextMessagesCount
  const maxMessages = pairs * 2
  if (messages.length <= maxMessages) return [...messages]
  return messages.slice(-maxMessages)
}
