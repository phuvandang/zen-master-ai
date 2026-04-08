'use client'

import { useState, useRef } from 'react'

interface Props {
  onSend: (message: string) => void
  disabled: boolean
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }

  return (
    <div className="border-t border-stone-200 bg-white px-4 py-3">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            disabled
              ? 'Zen Master đang trả lời...'
              : 'Nhắn tin... (gõ /end để kết thúc buổi)'
          }
          rows={1}
          className="flex-1 resize-none rounded-xl border border-stone-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:opacity-50"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="rounded-xl bg-stone-700 px-4 py-2.5 text-sm text-white hover:bg-stone-800 disabled:opacity-40 transition-colors"
        >
          Gửi
        </button>
      </div>
      <p className="text-xs text-stone-400 text-center mt-1.5">
        Enter để gửi · Shift+Enter xuống dòng
      </p>
    </div>
  )
}
