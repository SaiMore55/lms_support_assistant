# LMS Support Assistant

A responsive chatbot that helps students, teachers and administrators with common LMS problems (login, courses, assignments, grades, video and upload issues). It works **out of the box in FAQ mode** and upgrades to **AI mode** when you add an Anthropic API key.

**Stack:** React + Vite + Tailwind CSS · Flask · SQLite · REST/JSON

## Run locally

You need Python 3.10+ and Node.js 18+.

**1. Backend** (terminal 1)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # Windows: copy .env.example .env
python app.py                      # http://127.0.0.1:5000
```

**2. Frontend** (terminal 2)
```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```
Open http://localhost:5173. Vite proxies `/api` to the Flask server.

## Optional: AI mode
Put your key in `backend/.env`:
```
ANTHROPIC_API_KEY=your-key-here
```
Restart the backend. The key stays on the server and is never sent to the browser. The model gets the FAQ entries as context and a system prompt that forbids inventing policies/grades/deadlines or asking for credentials. If the AI call fails, the app falls back to FAQ mode automatically. `GET /api/health` shows the current mode.

## Tests
```bash
cd backend && python test_api.py
```
Covers all endpoints, validation, the seven sample questions, the fallback, and the credential-safety check.

## API
All responses look like `{"success": true, "data": {...}}` or `{"success": false, "error": {"code", "message"}}`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/chat` | `{message, conversation_id?, history?}` → reply, suggestions, `escalate` flag |
| GET | `/api/faqs` | FAQ list for the sidebar |
| POST | `/api/feedback` | `{rating: "up"|"down", unresolved?, comment?, conversation_id, message_id}` |
| POST | `/api/escalate` | `{name, email, category, description}` → support ticket number |
| GET | `/api/health` | Health and mode (`faq` / `ai`) |

## Customising the knowledge base
Edit `backend/knowledge_base.json`. Each entry has `question`, `answer`, `category`, `keywords` (matching phrases) and `followups`. Restart the backend and the sidebar FAQs update. Answers use generic menu names, so adjust them to match your institution's LMS (Moodle, Canvas, Blackboard, etc.).

## Project structure
```
backend/   app.py · knowledge_base.json · test_api.py · requirements.txt · .env.example
frontend/  src/App.jsx · src/api.js · src/components/{Sidebar,Message,SupportModal}.jsx
```

## Notes
- Chat history lives in the browser session (sessionStorage); the server stores only conversation metadata, feedback and support requests in SQLite (`backend/lms_support.db`, created automatically).
- Support requests are saved to the `escalations` table. Connect an email or ticketing service in `/api/escalate` for production.
- For a larger deployment, swap SQLite for PostgreSQL and run Flask behind gunicorn.
