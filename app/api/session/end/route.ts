import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, getRecentMessages } from '@/lib/prompt'
import {
  generateFarewell,
  generateDailyLog,
  generateReflection,
  computeProgressUpdate,
  checkAndCompact,
} from '@/lib/pipeline'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sessionId } = await request.json()

  const encoder = new TextEncoder()

  function emit(event: object): Uint8Array {
    return encoder.encode(JSON.stringify(event) + '\n')
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const [systemPrompt, history] = await Promise.all([
          buildSystemPrompt(user.id),
          getRecentMessages(sessionId),
        ])

        // Step 0: Farewell message (stream chunks)
        controller.enqueue(emit({ type: 'progress', step: 'farewell', label: 'Zen Master đang tạm biệt...' }))

        const farewellText = await generateFarewell(history, systemPrompt, (chunk) => {
          controller.enqueue(emit({ type: 'farewell_chunk', chunk }))
        })

        // Save farewell as assistant message
        await supabase.from('messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: farewellText,
        })

        // Step 1: Daily log
        controller.enqueue(emit({ type: 'progress', step: 'daily_log', label: 'Đang ghi lại buổi học...' }))
        const dailyLog = await generateDailyLog(history)
        await supabase.from('daily_logs').insert({
          user_id: user.id,
          session_id: sessionId,
          content: dailyLog,
          log_date: new Date().toISOString().split('T')[0],
        })

        // Step 2: Reflection
        controller.enqueue(emit({ type: 'progress', step: 'reflection', label: 'Đang suy ngẫm về buổi học...' }))
        const { data: progress } = await supabase
          .from('user_progress')
          .select('level, mastered_topics, current_topics, patterns, teaching_notes')
          .eq('user_id', user.id)
          .single()

        const currentProgressStr = JSON.stringify(progress ?? {})
        const reflection = await generateReflection(history, currentProgressStr)
        await supabase.from('reflections').insert({
          user_id: user.id,
          session_id: sessionId,
          content: reflection,
        })

        // Step 3: Update progress
        controller.enqueue(emit({ type: 'progress', step: 'progress', label: 'Đang cập nhật hành trình học...' }))
        if (progress) {
          const updatedProgress = await computeProgressUpdate(reflection, progress)
          if (updatedProgress) {
            await supabase
              .from('user_progress')
              .update({ ...updatedProgress, updated_at: new Date().toISOString() })
              .eq('user_id', user.id)
          }
        }

        // Step 4: Mark session ended
        await supabase
          .from('sessions')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', sessionId)

        // Step 5: Compaction (optional)
        const compacted = await checkAndCompact(user.id, supabase)
        if (compacted) {
          controller.enqueue(emit({ type: 'progress', step: 'compaction', label: 'Bộ nhớ dài hạn đã được cập nhật.' }))
        }

        controller.enqueue(emit({ type: 'done' }))
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(emit({ type: 'error', error: message }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
    },
  })
}
