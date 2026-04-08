import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, getRecentMessages, getRecentReflections } from '@/lib/prompt'
import { searchKnowledge } from '@/lib/knowledge'

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

  // Build context in parallel
  const [systemPrompt, history, recentReflections, knowledgeContext] = await Promise.all([
    buildSystemPrompt(user.id),
    getRecentMessages(sessionId),
    getRecentReflections(user.id, 3),
    searchKnowledge(message, supabase),
  ])

  // Prepend reflections as first assistant message
  const messages = [
    ...(recentReflections.length > 0 ? [{
      role: 'assistant' as const,
      content: '[Suy ngẫm từ những buổi trước — ghi chú nội bộ để hiểu học trò tốt hơn]\n\n' +
        recentReflections.join('\n\n---\n\n'),
    }] : []),
    ...history,
  ]

  // Augment last user message with knowledge context if found
  const finalMessages = knowledgeContext
    ? messages.map((m, i) =>
        i === messages.length - 1 && m.role === 'user'
          ? { ...m, content: m.content + knowledgeContext }
          : m
      )
    : messages

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
          messages: finalMessages,
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
