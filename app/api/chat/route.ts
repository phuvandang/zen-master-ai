import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, getRecentMessages, getRecentReflections } from '@/lib/prompt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { message, sessionId } = await request.json()

  // Save user message to DB first
  await supabase.from('messages').insert({
    session_id: sessionId,
    role: 'user',
    content: message,
  })

  // Build system prompt, conversation history, and inject recent reflections
  const [systemPrompt, history, recentReflections] = await Promise.all([
    buildSystemPrompt(user.id),
    getRecentMessages(sessionId),
    getRecentReflections(user.id, 3),
  ])

  // Prepend reflections as first assistant message (internal context for the Master)
  const messages = [
    ...(recentReflections.length > 0 ? [{
      role: 'assistant' as const,
      content: '[Suy ngẫm từ những buổi trước — ghi chú nội bộ để hiểu học trò tốt hơn]\n\n' +
        recentReflections.join('\n\n---\n\n'),
    }] : []),
    ...history,
  ]

  // Stream response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = ''

      try {
        const claudeStream = await anthropic.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        })

        for await (const chunk of claudeStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const text = chunk.delta.text
            fullResponse += text
            controller.enqueue(encoder.encode(text))
          }
        }

        // Save assistant response
        await supabase.from('messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: fullResponse,
        })

        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
