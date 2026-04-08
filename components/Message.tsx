import type { Message as MessageType } from '@/lib/types'

export default function Message({ message }: { message: MessageType }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-stone-600 flex items-center justify-center text-white text-xs mr-3 flex-shrink-0 mt-1">
          禅
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-stone-700 text-white rounded-br-sm'
            : 'bg-white text-stone-800 shadow-sm rounded-bl-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
