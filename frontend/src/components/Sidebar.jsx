import { useState } from 'react'

export function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#1d4ed8" />
      <path d="M11 13.5h18a2 2 0 0 1 2 2V23a2 2 0 0 1-2 2H21l-5 4v-4h-5a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z" fill="#fff" />
      <path d="M15 18.5h10M15 21.5h6" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function Sidebar({ conversations, activeId, faqs, onNew, onSelect, onAsk, open, onClose }) {
  const [openFaq, setOpenFaq] = useState(null)
  const categories = [...new Set(faqs.map((f) => f.category))]

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 md:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <Logo />
          <div className="leading-tight">
            <p className="font-bold text-slate-900">LMS Support</p>
            <p className="text-xs text-slate-500">Assistant</p>
          </div>
        </div>

        <div className="px-4">
          <button onClick={() => { onNew(); onClose() }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800">
            <span aria-hidden="true" className="text-lg leading-none">+</span> New chat
          </button>
        </div>

        <nav className="mt-5 min-h-0 flex-1 overflow-y-auto px-4 pb-4" aria-label="Conversations and FAQs">
          <h2 className="px-1 text-xs font-semibold text-slate-500">Recent conversations</h2>
          <ul className="mt-2 space-y-1">
            {conversations.filter((c) => c.messages.length).length === 0 && <li className="px-1 text-sm text-slate-400">No conversations yet.</li>}
            {conversations.filter((c) => c.messages.length).map((c) => (
              <li key={c.id}>
                <button onClick={() => { onSelect(c.id); onClose() }} aria-current={c.id === activeId}
                  className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${c.id === activeId ? 'bg-blue-50 font-semibold text-blue-800' : 'text-slate-700 hover:bg-slate-100'}`}>
                  {c.title}
                </button>
              </li>
            ))}
          </ul>

          <h2 className="mt-6 px-1 text-xs font-semibold text-slate-500">Frequently asked questions</h2>
          <div className="mt-2 space-y-1">
            {categories.map((cat) => (
              <div key={cat}>
                <button onClick={() => setOpenFaq(openFaq === cat ? null : cat)} aria-expanded={openFaq === cat}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {cat}<span aria-hidden="true" className={`text-slate-400 transition ${openFaq === cat ? 'rotate-90' : ''}`}>›</span>
                </button>
                {openFaq === cat && (
                  <ul className="mb-1 ml-3 border-l border-blue-100 pl-2">
                    {faqs.filter((f) => f.category === cat).map((f) => (
                      <li key={f.id}>
                        <button onClick={() => { onAsk(f.question); onClose() }} className="w-full rounded-md px-2 py-1.5 text-left text-[13px] text-slate-600 hover:bg-blue-50 hover:text-blue-800">{f.question}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </nav>
      </aside>
    </>
  )
}
