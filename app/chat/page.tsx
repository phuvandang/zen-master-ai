'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ChatWindow from '@/components/ChatWindow'
import MessageInput from '@/components/MessageInput'
import type { Message, Session } from '@/lib/types'

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/session')
      const { session } = await res.json()
      setSession(session)

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })

      setMessages(data ?? [])
    }
    init()
  }, [])

  async function handleSend(message: string) {
    if (!session) return

    if (message.toLowerCase().startsWith('/end')) {
      await handleSessionEnd()
      return
    }

    setIsStreaming(true)
    setStreamingText('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId: session.id }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setStreamingText(accumulated)
      }

      // Reload messages from DB to get real IDs and consistent state
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })

      setMessages(data ?? [])
      setStreamingText('')
    } catch {
      setStreamingText('Đã có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setIsStreaming(false)
    }
  }

  async function handleSessionEnd() {
    if (!session) return
    setIsStreaming(true)
    setStreamingText('Kết thúc buổi học...')

    await supabase
      .from('sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', session.id)

    setStreamingText('')
    setIsStreaming(false)

    // Start a fresh session
    const res = await fetch('/api/session')
    const { session: newSession } = await res.json()
    setSession(newSession)
    setMessages([])
  }

  return (
    <div className="flex flex-col h-screen bg-stone-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-stone-200 flex-shrink-0">
        <h1 className="text-base font-medium text-stone-800">Zen Master AI</h1>
        <div className="flex gap-4 text-sm text-stone-500">
          <a href="/vault" className="hover:text-stone-800 transition-colors">
            Hầm trí tuệ
          </a>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/'
            }}
            className="hover:text-stone-800 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Chat */}
      <ChatWindow messages={messages} streamingText={streamingText} />

      {/* Input */}
      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  )
}
