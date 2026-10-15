const BASE = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...options })
  } catch {
    throw new Error('Cannot reach the support server. Make sure the backend is running on port 5000.')
  }
  let body = null
  try { body = await res.json() } catch { /* non-JSON response */ }
  if (!res.ok || !body?.success) throw new Error(body?.error?.message || `Request failed (${res.status}).`)
  return body.data
}

const post = (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) })

export const sendChat = (message, conversation_id, history) => post('/chat', { message, conversation_id, history })
export const getFaqs = () => request('/faqs')
export const sendFeedback = (data) => post('/feedback', data)
export const escalate = (data) => post('/escalate', data)
