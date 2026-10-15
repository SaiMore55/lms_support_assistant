import { useState } from 'react'
import { Logo } from './Sidebar'

function Rich({ text }) {
  return text.split('\n').map((line, i) => (
    <p key={i} className={line.trim() ? 'min-h-[1.25em]' : 'h-2'}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong> : part)}
    </p>
  ))
}

export function Typing() {
  return (
    <div className="flex items-start gap-3" role="status" aria-label="Assistant is typing">
      <Logo size={32} />
      <div className="flex gap-1.5 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
        {[0, 1, 2].map((i) => <span key={i} className="dot h-2 w-2 rounded-full bg-blue-500" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
    </div>
  )
}

export default function Message({ msg, isLast, onSuggest, onRate, onSupport }) {
  const [rating, setRating] = useState(msg.rating || null)

  if (msg.role === 'user') {
    return (
      <div className="pop flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-blue-700 px-4 py-2.5 text-[15px] text-white shadow-sm sm:max-w-[70%]">{msg.content}</div>
      </div>
    )
  }

  const rate = (value) => { setRating(value); onRate(msg, value) }
  return (
    <div className="pop flex items-start gap-3">
      <Logo size={32} />
      <div className="min-w-0 max-w-[88%] sm:max-w-[75%]">
        <div className={`space-y-0.5 break-words rounded-2xl rounded-tl-md border px-4 py-3 text-[15px] leading-relaxed shadow-sm ${msg.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-slate-200 bg-white'}`}>
          <Rich text={msg.content} />
        </div>

        {!msg.error && msg.id && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <span>Was this helpful?</span>
            {[['up', '👍', 'Helpful'], ['down', '👎', 'Not helpful']].map(([v, icon, label]) => (
              <button key={v} onClick={() => rate(v)} aria-label={label} aria-pressed={rating === v}
                className={`rounded-md px-2 py-1 transition hover:bg-slate-100 ${rating === v ? 'bg-blue-100' : ''}`}>{icon}</button>
            ))}
            <button onClick={() => onSupport(msg, true)} className="rounded-md px-2 py-1 font-medium text-blue-700 underline-offset-2 hover:underline">Report unresolved issue</button>
          </div>
        )}

        {isLast && msg.escalate && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
            <span>Still stuck? Our support team can look at your account.</span>
            <button onClick={() => onSupport(msg, false)} className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800">Contact support</button>
          </div>
        )}

        {isLast && msg.suggestions?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msg.suggestions.map((s) => (
              <button key={s} onClick={() => onSuggest(s)} className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[13px] font-medium text-blue-800 transition hover:bg-blue-50">{s}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
