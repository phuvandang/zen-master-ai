import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Return existing active session if any
  const { data: existing } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ session: existing })
  }

  // Count today's sessions to set session_number
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('started_at', `${today}T00:00:00`)

  const { data: session } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      session_number: (count ?? 0) + 1,
    })
    .select()
    .single()

  return NextResponse.json({ session })
}
