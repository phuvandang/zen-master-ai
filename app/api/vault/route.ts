import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractTranscript, extractVideoId } from '@/lib/knowledge'

export const maxDuration = 120

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: sources } = await supabase
    .from('knowledge_sources')
    .select('id, source_key, title, teacher, source_url, topics, created_at')
    .order('created_at', { ascending: false })

  return NextResponse.json({ sources: sources ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { url, title, teacher, topics } = await request.json()

  if (!url || !title) {
    return NextResponse.json({ error: 'URL và tiêu đề là bắt buộc.' }, { status: 400 })
  }

  const videoId = extractVideoId(url)
  if (!videoId) {
    return NextResponse.json({ error: 'URL YouTube không hợp lệ.' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('knowledge_sources')
    .select('id')
    .eq('source_key', videoId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Video này đã có trong Hầm trí tuệ.' }, { status: 409 })
  }

  let content: string
  try {
    content = await extractTranscript(url)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể lấy transcript.'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  const topicsArray = typeof topics === 'string'
    ? topics.split(',').map((t: string) => t.trim()).filter(Boolean)
    : (Array.isArray(topics) ? topics : [])

  const { data: source, error } = await supabase
    .from('knowledge_sources')
    .insert({
      added_by: user.id,
      source_key: videoId,
      title: title.trim(),
      teacher: (teacher ?? '').trim(),
      source_url: url.trim(),
      topics: topicsArray,
      content,
    })
    .select('id, source_key, title, teacher, source_url, topics, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Lỗi khi lưu vào database.' }, { status: 500 })
  }

  return NextResponse.json({ source }, { status: 201 })
}
