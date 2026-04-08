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
