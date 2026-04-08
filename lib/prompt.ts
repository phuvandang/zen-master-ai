import { createClient } from '@/lib/supabase/server'
import type { AnthropicMessage } from '@/lib/types'

export async function buildSystemPrompt(userId: string): Promise<string> {
  const supabase = await createClient()

  const [
    { data: soulRows },
    { data: profile },
    { data: progress },
    { data: memory },
  ] = await Promise.all([
    supabase.from('soul_config').select('key, content'),
    supabase.from('profiles').select('name, address_style').eq('id', userId).single(),
    supabase.from('user_progress').select('level, mastered_topics, current_topics, patterns, teaching_notes').eq('user_id', userId).single(),
    supabase.from('user_memory').select('content').eq('user_id', userId).single(),
  ])

  const soul = soulRows?.find(r => r.key === 'soul')?.content ?? ''
  const teaching = soulRows?.find(r => r.key === 'teaching_philosophy')?.content ?? ''
  const rules = soulRows?.find(r => r.key === 'rules')?.content ?? ''

  const parts: string[] = []

  if (soul) parts.push(`# NHÂN CÁCH\n${soul}`)
  if (teaching) parts.push(`# PHƯƠNG PHÁP GIẢNG DẠY\n${teaching}`)

  if (profile) {
    parts.push([
      `# THÔNG TIN HỌC TRÒ`,
      `- Tên: ${profile.name ?? '(chưa biết)'}`,
      `- Cách xưng hô: "${profile.address_style}"`,
    ].join('\n'))
  }

  if (progress) {
    parts.push([
      `# TRÌNH ĐỘ HỌC TRÒ`,
      `- Mức độ: ${progress.level}`,
      progress.mastered_topics ? `- Đã nắm vững: ${progress.mastered_topics}` : '',
      progress.current_topics ? `- Đang học: ${progress.current_topics}` : '',
      progress.patterns ? `- Patterns: ${progress.patterns}` : '',
      progress.teaching_notes ? `- Teaching notes: ${progress.teaching_notes}` : '',
    ].filter(Boolean).join('\n'))
  }

  if (memory?.content) {
    parts.push(`# LONG-TERM MEMORY\n${memory.content}`)
  }

  if (rules) parts.push(`# QUY TẮC VẬN HÀNH\n${rules}`)

  return parts.join('\n\n---\n\n')
}

export async function getRecentMessages(
  sessionId: string,
  limit = 20
): Promise<AnthropicMessage[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit)

  return (data ?? []) as AnthropicMessage[]
}

export async function getRecentReflections(
  userId: string,
  limit = 3
): Promise<string[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('reflections')
    .select('content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map(r => r.content)
}
