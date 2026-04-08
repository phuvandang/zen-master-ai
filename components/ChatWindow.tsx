'use client'

import { useEffect, useRef } from 'react'
import Message from './Message'
import type { Message as MessageType } from '@/lib/types'

interface Props {
  messages: MessageType[]
  streamingText: string
}

export default function ChatWindow({ messages, streamingText }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full">
      {messages.length === 0 && !streamingText && (
        <div className="text-center text-stone-400 text-sm mt-20">
          <div className="text-5xl mb-4">禅</div>
          <p>Bắt đầu cuộc trò chuyện với Zen Master</p>
        </div>
      )}

      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}

      {streamingText && (
        <div className="flex justify-start mb-4">
          <div className="w-8 h-8 rounded-full bg-stone-600 flex items-center justify-center text-white text-xs mr-3 flex-shrink-0 mt-1">
            禅
          </div>
          <div className="max-w-[75%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-white text-stone-800 shadow-sm">
            {streamingText}
            <span className="inline-block w-0.5 h-4 bg-stone-400 ml-0.5 animate-pulse align-middle" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
