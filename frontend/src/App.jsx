import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar, { Logo } from './components/Sidebar'
import Message, { Typing } from './components/Message'
import SupportModal from './components/SupportModal'
import { getFaqs, sendChat, sendFeedback } from './api'

const WELCOME = "Hi! I'm your LMS Support Assistant. How can I help you today?"
const CARDS = [
  ['I cannot log in to my LMS account. What should I do?', 'Login problems', 'Fix sign-in errors and locked accounts'],
  ['How do I submit an assignment?', 'Assignments', 'Submit work and avoid upload errors'],
  ['Why can\'t I access my enrolled course?', 'Course access', 'Find out why a course is missing'],
  ['My lecture video is not playing.', 'Video playback', 'Step-by-step browser fixes'],
  ['How do I upload study materials as a teacher?', 'For teachers', 'Add files and resources to a course'],
  ['Where can I find my exam results?', 'Grades', 'Locate results and feedback'],
]
const QUICK = [
  ['Login Issues', 'I cannot log in to my LMS account. What should I do?'],
  ['Course Access', "Why can't I access my enrolled course?"],
  ['Assignment Help', 'How do I submit an assignment?'],
  ['Technical Support', 'My lecture video is not playing.'],
  ['Contact Support', null],
]
const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : String(Date.now() + Math.random()))
const newConvo = () => ({ id: uid(), title: 'New chat', messages: [] })

export default function App() {
  const [convos, setConvos] = useState(() => {
    try { const s = JSON.parse(sessionStorage.getItem('lms-convos')); if (s?.length) return s } catch { /* ignore */ }
    return [newConvo()]
  })
  const [activeId, setActiveId] = useState(() => sessionStorage.getItem('lms-active') || null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [faqs, setFaqs] = useState([])
  const [menu, setMenu] = useState(false)
  const [support, setSupport] = useState(null)
  const [toast, setToast] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)

  const active = convos.find((c) => c.id === activeId) || convos[0]

  useEffect(() => { getFaqs().then((d) => setFaqs(d.faqs)).catch(() => {}) }, [])
  useEffect(() => {
    sessionStorage.setItem('lms-convos', JSON.stringify(convos))
    sessionStorage.setItem('lms-active', active.id)
  }, [convos, active.id])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [active.messages.length, loading])
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t) } }, [toast])

  const update = useCallback((id, fn) => setConvos((cs) => cs.map((c) => (c.id === id ? fn(c) : c))), [])

  const send = useCallback(async (text) => {
    const message = (text ?? input).trim()
    if (!message || loading) return
    const cid = active.id
    const history = active.messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }))
    setInput(''); setError(null); setLoading(true)
    update(cid, (c) => ({ ...c, title: c.messages.length ? c.title : message.slice(0, 40), messages: [...c.messages, { role: 'user', content: message }] }))
    try {
      const d = await sendChat(message, cid, history)
      update(cid, (c) => ({ ...c, messages: [...c.messages, { role: 'assistant', id: d.message_id, content: d.reply, suggestions: d.suggestions, escalate: d.escalate }] }))
    } catch (e) {
      setError({ text: e.message, retry: message })
      update(cid, (c) => ({ ...c, messages: c.messages.slice(0, -1) }))
    } finally { setLoading(false); inputRef.current?.focus() }
  }, [active, input, loading, update])

  const newChat = () => {
    if (!active.messages.length) return
    const c = newConvo(); setConvos((cs) => [c, ...cs]); setActiveId(c.id); setError(null)
  }
  const onRate = (msg, rating) => sendFeedback({ conversation_id: active.id, message_id: msg.id, rating })
    .then(() => setToast('Thanks for your feedback!')).catch((e) => setToast(e.message))
  const onSupport = (msg, unresolved) => {
    if (unresolved) sendFeedback({ conversation_id: active.id, message_id: msg?.id, unresolved: true, comment: 'Reported as unresolved' }).catch(() => {})
    setSupport({ prefill: unresolved ? 'The assistant could not resolve my issue: ' : '' })
  }
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const empty = active.messages.length === 0

  return (
    <div className="flex h-full">
      <Sidebar conversations={convos} activeId={active.id} faqs={faqs} onNew={newChat} onSelect={(id) => { setActiveId(id); setError(null) }}
        onAsk={send} open={menu} onClose={() => setMenu(false)} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
          </button>
          <h1 className="text-base font-bold text-slate-900">LMS Support Assistant</h1>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />Online</span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8" aria-live="polite">
          <div className="mx-auto max-w-3xl space-y-5">
            {empty ? (
              <section className="pt-4 text-center sm:pt-10">
                <div className="flex justify-center"><Logo size={56} /></div>
                <h2 className="mx-auto mt-5 max-w-md text-2xl font-bold text-slate-900 sm:text-3xl">{WELCOME}</h2>
                <p className="mt-2 text-slate-500">Students, teachers and admins: ask in your own words, or start with a common question.</p>
                <div className="mt-8 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
                  {CARDS.map(([q, t, d]) => (
                    <button key={t} onClick={() => send(q)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                      <p className="font-semibold text-blue-800">{t}</p><p className="mt-1 text-sm text-slate-500">{d}</p>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <>
                <Message msg={{ role: 'assistant', content: WELCOME }} onRate={() => {}} onSuggest={() => {}} onSupport={() => {}} />
                {active.messages.map((m, i) => (
                  <Message key={m.id || i} msg={m} isLast={i === active.messages.length - 1 && !loading}
                    onSuggest={send} onRate={onRate} onSupport={onSupport} />
                ))}
              </>
            )}
            {loading && <Typing />}
            {error && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span>{error.text}</span>
                <button onClick={() => send(error.retry)} className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white hover:bg-red-800">Try again</button>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <footer className="border-t border-slate-200 bg-white px-4 py-3 md:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Quick actions">
              {QUICK.map(([label, q]) => (
                <button key={label} onClick={() => (q ? send(q) : setSupport({ prefill: '' }))}
                  className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800">{label}</button>
              ))}
            </div>
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/30">
              <label htmlFor="msg" className="sr-only">Message</label>
              <textarea id="msg" ref={inputRef} rows={1} value={input} maxLength={2000} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
                placeholder="Describe your issue…" className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              <button onClick={() => send()} disabled={!input.trim() || loading} aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M2.5 17.5 18 10 2.5 2.5l.01 5.83L12 10l-9.49 1.67-.01 5.83Z" /></svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-xs text-slate-400">Enter to send, Shift+Enter for a new line. Never share your password.</p>
          </div>
        </footer>
      </main>

      {support && <SupportModal conversationId={active.id} prefill={support.prefill} onClose={() => setSupport(null)} />}
      {toast && <div role="status" className="pop fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  )
}
