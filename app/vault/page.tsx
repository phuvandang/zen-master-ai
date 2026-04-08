'use client'

import { useState, useEffect } from 'react'
import type { KnowledgeSource } from '@/lib/types'

export default function VaultPage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [teacher, setTeacher] = useState('')
  const [topics, setTopics] = useState('')

  useEffect(() => {
    loadSources()
  }, [])

  async function loadSources() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/vault')
      const { sources } = await res.json()
      setSources(sources ?? [])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsAdding(true)

    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title, teacher, topics }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Đã có lỗi xảy ra.')
        return
      }

      setSuccess(`Đã thêm "${data.source.title}" vào Hầm trí tuệ.`)
      setUrl('')
      setTitle('')
      setTeacher('')
      setTopics('')
      await loadSources()
    } catch {
      setError('Không kết nối được server. Vui lòng thử lại.')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Xóa "${title}" khỏi Hầm trí tuệ?`)) return

    const res = await fetch(`/api/vault/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSources(prev => prev.filter(s => s.id !== id))
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-stone-200">
        <h1 className="text-base font-medium text-stone-800">Hầm trí tuệ</h1>
        <a href="/chat" className="text-sm text-stone-500 hover:text-stone-800 transition-colors">
          ← Quay lại chat
        </a>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h2 className="text-sm font-medium text-stone-700 mb-4">Thêm video pháp thoại</h2>

          <form onSubmit={handleAdd} className="space-y-3">
            <input
              type="url"
              placeholder="Link YouTube (https://youtube.com/watch?v=...)"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 placeholder-stone-400"
            />
            <input
              type="text"
              placeholder="Tiêu đề bài pháp thoại"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 placeholder-stone-400"
            />
            <input
              type="text"
              placeholder="Thầy / Tác giả (tùy chọn)"
              value={teacher}
              onChange={e => setTeacher(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 placeholder-stone-400"
            />
            <input
              type="text"
              placeholder="Chủ đề, phân cách bằng dấu phẩy (vd: thiền định, chánh niệm)"
              value={topics}
              onChange={e => setTopics(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400 placeholder-stone-400"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <button
              type="submit"
              disabled={isAdding}
              className="w-full py-2 px-4 text-sm bg-stone-800 text-white rounded-md hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAdding ? 'Đang xử lý... (có thể mất 30-60 giây)' : 'Thêm vào Hầm trí tuệ'}
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-sm font-medium text-stone-700 mb-3">
            Tài liệu đã lưu ({sources.length})
          </h2>

          {isLoading ? (
            <p className="text-sm text-stone-400">Đang tải...</p>
          ) : sources.length === 0 ? (
            <p className="text-sm text-stone-400">Chưa có tài liệu nào. Thêm video pháp thoại đầu tiên.</p>
          ) : (
            <div className="space-y-2">
              {sources.map(source => (
                <div
                  key={source.id}
                  className="bg-white rounded-lg border border-stone-200 px-4 py-3 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{source.title}</p>
                    {source.teacher && (
                      <p className="text-xs text-stone-500 mt-0.5">{source.teacher}</p>
                    )}
                    {source.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {source.topics.map(t => (
                          <span key={t} className="text-xs px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(source.id, source.title)}
                    className="text-stone-400 hover:text-red-500 transition-colors text-xs flex-shrink-0 mt-0.5"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
