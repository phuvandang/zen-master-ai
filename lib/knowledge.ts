import Anthropic from '@anthropic-ai/sdk'
import { YoutubeTranscript } from 'youtube-transcript'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SEARCH_KEYWORDS = [
  'thiền', 'chánh niệm', 'mindfulness', 'meditation',
  'phật', 'buddha', 'giác ngộ', 'enlightenment',
  'hơi thở', 'breath', 'tâm', 'khổ', 'suffering',
  'vô thường', 'impermanence', 'buông', 'từ bi', 'compassion',
  'bát chánh đạo', 'tứ diệu đế', 'niết bàn', 'nirvana', 'karma',
  'công án', 'koan', 'ngồi thiền', 'quán sát', 'observe',
]

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export async function extractTranscript(youtubeUrl: string): Promise<string> {
  const videoId = extractVideoId(youtubeUrl)
  if (!videoId) {
    throw new Error('URL không hợp lệ. Vui lòng dùng link YouTube hợp lệ.')
  }

  let rawItems
  try {
    rawItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'vi' })
  } catch {
    try {
      rawItems = await YoutubeTranscript.fetchTranscript(videoId)
    } catch {
      throw new Error('Không thể lấy transcript từ video này. Video có thể không có phụ đề tự động.')
    }
  }

  const rawText = rawItems.map(i => i.text).join(' ')

  if (rawText.length < 100) {
    throw new Error('Transcript quá ngắn hoặc trống.')
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: `Bạn là trợ lý xử lý transcript pháp thoại thiền định.
Tổ chức lại transcript thô thành văn bản có cấu trúc với heading theo chủ đề.
Làm sạch lỗi nhận dạng giọng nói. Giữ nguyên ý nghĩa và các thuật ngữ quan trọng.
Tối đa 3000 từ. Trả về văn bản markdown.`,
    messages: [{
      role: 'user',
      content: `Transcript thô:\n\n${rawText.slice(0, 8000)}`,
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : rawText.slice(0, 3000)
}

export async function searchKnowledge(
  message: string,
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
): Promise<string> {
  if (message.length <= 20) return ''

  const lower = message.toLowerCase()
  const hasKeyword = SEARCH_KEYWORDS.some(k => lower.includes(k))
  if (!hasKeyword) return ''

  const { data: sources } = await supabase
    .from('knowledge_sources')
    .select('title, teacher, topics, content')
    .limit(10)

  if (!sources || sources.length === 0) return ''

  const scored = sources.map(s => {
    const topicMatches = (s.topics as string[]).filter(t =>
      lower.includes(t.toLowerCase())
    ).length
    const titleWords = s.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
    const titleMatches = titleWords.filter((w: string) => lower.includes(w)).length
    return { ...s, score: topicMatches * 2 + titleMatches }
  })

  const relevant = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)

  if (relevant.length === 0) return ''

  const context = relevant
    .map(s => `[Từ tài liệu: "${s.title}"${s.teacher ? ` — ${s.teacher}` : ''}]\n${(s.content as string).slice(0, 1500)}`)
    .join('\n\n---\n\n')

  return '\n\n[Tài liệu tham khảo từ Hầm trí tuệ:]\n\n' + context
}
