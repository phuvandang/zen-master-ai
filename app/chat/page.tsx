'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ChatWindow from '@/components/ChatWindow'
import MessageInput from '@/components/MessageInput'
import type { Message, Session, PipelineEvent } from '@/lib/types'

const PIPELINE_LABELS: Record<string, string> = {
  farewell: 'Zen Master đang tạm biệt...',
  daily_log: 'Ghi lại buổi học...',
  reflection: 'Suy ngẫm về buổi học...',
  progress: 'Cập nhật hành trình học...',
  compaction: 'Cập nhật bộ nhớ dài hạn...',
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [pipelineStep, setPipelineStep] = useState<string | null>(null)
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
    setStreamingText('')
    setPipelineStep('farewell')

    try {
      const res = await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let farewellAccumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event: PipelineEvent = JSON.parse(line)

            if (event.type === 'farewell_chunk' && event.chunk) {
              farewellAccumulated += event.chunk
              setStreamingText(farewellAccumulated)
            } else if (event.type === 'progress' && event.step) {
              setPipelineStep(event.step)
              if (event.step !== 'farewell') {
                setStreamingText('')
              }
            } else if (event.type === 'done') {
              setPipelineStep(null)
            }
          } catch {
            // ignore malformed lines
          }
        }
      }

      setStreamingText('')

      // Start fresh session
      const sessionRes = await fetch('/api/session')
      const { session: newSession } = await sessionRes.json()
      setSession(newSession)
      setMessages([])
    } catch {
      setStreamingText('Đã có lỗi khi kết thúc buổi học. Vui lòng thử lại.')
      setPipelineStep(null)
    } finally {
      setIsStreaming(false)
    }
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

      {/* Pipeline progress banner */}
      {pipelineStep && pipelineStep !== 'farewell' && (
        <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-700 flex items-center gap-2">
          <span className="animate-pulse">●</span>
          {PIPELINE_LABELS[pipelineStep] ?? 'Đang xử lý...'}
        </div>
      )}

      {/* Chat */}
      <ChatWindow messages={messages} streamingText={streamingText} />

      {/* Input */}
      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  )
}
