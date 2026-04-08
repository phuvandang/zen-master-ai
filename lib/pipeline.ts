import Anthropic from '@anthropic-ai/sdk'
import type { AnthropicMessage } from '@/lib/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Step 0: Generate farewell message (streaming).
 */
export async function generateFarewell(
  history: AnthropicMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  let farewell = ''

  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      ...history,
      {
        role: 'user',
        content: '/end — học trò muốn kết thúc buổi học.',
      },
    ],
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      farewell += chunk.delta.text
      onChunk(chunk.delta.text)
    }
  }

  return farewell
}

/**
 * Step 1: Generate daily log (Sonnet — cost saving).
 */
export async function generateDailyLog(history: AnthropicMessage[]): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `Tạo bản tóm tắt ngắn gọn (dưới 300 từ) cho buổi trò chuyện thiền định dưới đây.
Format markdown, gồm:
- **Chủ đề chính** được thảo luận
- **Câu hỏi quan trọng** học trò đặt ra
- **Insight hoặc nhận ra mới** của học trò
- **Bài tập hoặc hướng dẫn** đã đưa ra
- **Cảm xúc/trạng thái** nổi bật của học trò`,
    messages: history,
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

/**
 * Step 2: Generate 5-part reflection (Opus — needs depth).
 */
export async function generateReflection(
  history: AnthropicMessage[],
  currentProgress: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    system: `Bạn là Zen Master đang tự suy ngẫm sau buổi dạy.
Viết bằng giọng nội tâm — sắc bén, thẳng thắn, tự phê bình.
KHÔNG viết giọng ấm áp như khi nói chuyện với học trò.

Phân tích theo 5 phần:

### Surface
Học trò hỏi và nói gì (factual, không phân tích).

### Beneath
Đằng sau câu hỏi bề mặt, học trò thực sự đang tìm kiếm gì?
Có pattern nào lặp lại từ những buổi trước?

### Method
Phương pháp dạy đã dùng trong buổi này có hiệu quả không? Tại sao?
Nên thay đổi gì cho lần sau?

### Next Intent
Lần tới nếu chủ đề tương tự quay lại, nên dẫn dắt theo hướng nào?
Có bài tập nào nên gợi ý?

### Learner Update
Cần ghi nhận hoặc cập nhật gì về học trò?
(pattern mới, điểm mạnh, điểm cần theo dõi, thay đổi level?)

PROGRESS hiện tại:
${currentProgress}`,
    messages: history,
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

/**
 * Step 3: Update user progress based on reflection (Sonnet).
 * Returns updated progress fields, or null if no change needed.
 */
export async function computeProgressUpdate(
  reflection: string,
  currentProgress: {
    level: string
    mastered_topics: string
    current_topics: string
    patterns: string
    teaching_notes: string
  }
): Promise<{
  level: string
  mastered_topics: string
  current_topics: string
  patterns: string
  teaching_notes: string
} | null> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `Dựa trên reflection và thông tin progress hiện tại, hãy:
1. Quyết định có cần cập nhật progress không.
2. Nếu CÓ: trả về JSON object với các field: level, mastered_topics, current_topics, patterns, teaching_notes.
3. Nếu KHÔNG: trả về chính xác chuỗi "NO_UPDATE".

Chỉ cập nhật khi có thay đổi có ý nghĩa (chủ đề mới nắm vững, pattern mới, thay đổi level).
Trả về JSON thuần túy không có markdown code block.`,
    messages: [{
      role: 'user',
      content: `Reflection:\n${reflection}\n\nProgress hiện tại:\n${JSON.stringify(currentProgress, null, 2)}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  if (text === 'NO_UPDATE') return null

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Step 4: Check if compaction is needed (>= 7 uncompacted daily logs).
 * If so, run meta-reflection and update user_memory.
 * Returns true if compaction ran.
 */
export async function checkAndCompact(
  userId: string,
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
): Promise<boolean> {
  // Get last meta-reflection date
  const { data: lastMeta } = await supabase
    .from('meta_reflections')
    .select('covers_to')
    .eq('user_id', userId)
    .order('covers_to', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Count uncompacted daily logs
  let query = supabase
    .from('daily_logs')
    .select('id, content, log_date', { count: 'exact' })
    .eq('user_id', userId)
    .order('log_date', { ascending: true })

  if (lastMeta?.covers_to) {
    query = query.gt('log_date', lastMeta.covers_to)
  }

  const { data: uncompactedLogs, count } = await query

  if (!count || count < 7 || !uncompactedLogs) return false

  // Fetch recent reflections for compaction
  const { data: recentReflections } = await supabase
    .from('reflections')
    .select('content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(count)

  const { data: currentMemory } = await supabase
    .from('user_memory')
    .select('content')
    .eq('user_id', userId)
    .single()

  const logsText = uncompactedLogs.map(l => `### ${l.log_date}\n${l.content}`).join('\n\n')
  const reflectionsText = (recentReflections ?? []).map(r => r.content).join('\n\n---\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 3000,
    system: `Phân tích các daily logs và reflections dưới đây.
Tìm:
- Pattern lặp lại xuyên suốt nhiều buổi
- Sự tiến bộ hoặc thoái lùi của học trò
- Chủ đề cốt lõi cần đối mặt trực tiếp
- Insights quan trọng cần nhớ lâu dài

Sau đó tổng hợp vào MEMORY.md mới. Giữ lại những gì quan trọng từ MEMORY.md cũ.
Viết ngắn gọn, súc tích. Tối đa 500 từ.
Trả về nội dung MEMORY.md mới hoàn chỉnh (markdown).`,
    messages: [{
      role: 'user',
      content: `MEMORY.md hiện tại:\n${currentMemory?.content ?? '(trống)'}\n\nDaily logs:\n${logsText}\n\nReflections:\n${reflectionsText}`,
    }],
  })

  const newMemory = response.content[0].type === 'text' ? response.content[0].text : ''

  const coversFrom = uncompactedLogs[0].log_date
  const coversTo = uncompactedLogs[uncompactedLogs.length - 1].log_date

  await Promise.all([
    supabase.from('meta_reflections').insert({
      user_id: userId,
      content: newMemory,
      covers_from: coversFrom,
      covers_to: coversTo,
    }),
    supabase.from('user_memory').update({ content: newMemory, updated_at: new Date().toISOString() }).eq('user_id', userId),
  ])

  return true
}
