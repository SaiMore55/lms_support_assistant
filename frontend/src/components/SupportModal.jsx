import { useEffect, useRef, useState } from 'react'
import { escalate } from '../api'

const CATEGORIES = ['Login & Account', 'Course Access', 'Assignments & Grades', 'Technical Issue', 'Other']

export default function SupportModal({ conversationId, prefill = '', onClose }) {
  const [form, setForm] = useState({ name: '', email: '', category: CATEGORIES[0], description: prefill })
  const [state, setState] = useState({ busy: false, error: '', ticket: '' })
  const first = useRef(null)
  useEffect(() => {
    first.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    setState({ busy: true, error: '', ticket: '' })
    try {
      const { ticket } = await escalate({ ...form, conversation_id: conversationId })
      setState({ busy: false, error: '', ticket })
    } catch (err) { setState({ busy: false, error: err.message, ticket: '' }) }
  }
  const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="support-title" className="pop max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        {state.ticket ? (
          <div className="text-center">
            <h2 id="support-title" className="text-lg font-bold text-slate-900">Request sent</h2>
            <p className="mt-2 text-sm text-slate-600">Your ticket number is <strong>{state.ticket}</strong>. The support team will reply to {form.email}.</p>
            <button autoFocus onClick={onClose} className="mt-5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Close</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 id="support-title" className="text-lg font-bold text-slate-900">Contact support</h2>
            <p className="mt-1 text-sm text-slate-500">Don't include passwords or one-time codes.</p>
            <label className="mt-4 block text-sm font-medium">Your name
              <input ref={first} className={input} value={form.name} onChange={set('name')} autoComplete="name" required /></label>
            <label className="mt-3 block text-sm font-medium">Email
              <input className={input} type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></label>
            <label className="mt-3 block text-sm font-medium">Topic
              <select className={input} value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="mt-3 block text-sm font-medium">What's happening?
              <textarea className={input} rows={4} value={form.description} onChange={set('description')} maxLength={2000} required /></label>
            {state.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button disabled={state.busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{state.busy ? 'Sending…' : 'Send request'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
