export type Role = 'user' | 'assistant'

export interface Message {
  id: string
  session_id: string
  role: Role
  content: string
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  session_number: number
}

export interface Profile {
  id: string
  name: string | null
  address_style: 'bạn' | 'con'
  is_admin: boolean
}

export interface UserProgress {
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  mastered_topics: string
  current_topics: string
  patterns: string
  teaching_notes: string
}

export interface AnthropicMessage {
  role: Role
  content: string
}

export interface DailyLog {
  id: string
  user_id: string
  session_id: string
  content: string
  log_date: string
  created_at: string
}

export interface Reflection {
  id: string
  user_id: string
  session_id: string
  content: string
  created_at: string
}

export interface MetaReflection {
  id: string
  user_id: string
  content: string
  covers_from: string
  covers_to: string
  created_at: string
}

export type PipelineStep = 'farewell' | 'daily_log' | 'reflection' | 'progress' | 'compaction' | 'done'

export interface PipelineEvent {
  type: 'progress' | 'farewell_chunk' | 'done' | 'error'
  step?: PipelineStep
  label?: string
  chunk?: string
  error?: string
}
