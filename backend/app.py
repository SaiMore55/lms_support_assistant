"""LMS Support Assistant - Flask backend."""
import json, os, re, sqlite3, uuid
from datetime import datetime, timezone
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE, "lms_support.db"))
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
STOP = set("i a an the is are my me to do how can what why where of in on for and it be am with this that you your not cant cannot".split())
DEFAULT_SUGGESTIONS = ["I cannot log in to my LMS account", "How do I submit an assignment?", "My lecture video is not playing"]
SYSTEM_PROMPT = (
    "You are the LMS Support Assistant for students, teachers and administrators of a Learning Management System. "
    "Be friendly, concise and student-focused. Give step-by-step troubleshooting. Ask a follow-up question if the issue is unclear. "
    "Never invent LMS policies, grades, deadlines or account details; say clearly when you cannot verify something. "
    "Never ask for or repeat passwords, tokens or other credentials. "
    "For account-specific or unresolved issues, suggest contacting the human support team. "
    "Prefer the knowledge base below when relevant."
)

app = Flask(__name__)
CORS(app, origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","))
with open(os.path.join(BASE, "knowledge_base.json"), encoding="utf-8") as f:
    KB = json.load(f)


# ---------- database ----------
def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(_):
    conn = g.pop("db", None)
    if conn:
        conn.close()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS faqs(id TEXT PRIMARY KEY, category TEXT, question TEXT, answer TEXT);
    CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, title TEXT, created_at TEXT, message_count INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT, message_id TEXT,
        rating TEXT, comment TEXT, unresolved INTEGER DEFAULT 0, created_at TEXT);
    CREATE TABLE IF NOT EXISTS escalations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, category TEXT,
        description TEXT, conversation_id TEXT, created_at TEXT);
    """)
    for e in KB:
        conn.execute("INSERT OR REPLACE INTO faqs VALUES(?,?,?,?)", (e["id"], e["category"], e["question"], e["answer"]))
    conn.commit(); conn.close()

now = lambda: datetime.now(timezone.utc).isoformat()
ok = lambda data, code=200: (jsonify({"success": True, "data": data}), code)
fail = lambda code, msg, status=400: (jsonify({"success": False, "error": {"code": code, "message": msg}}), status)

@app.errorhandler(404)
def _404(_): return fail("not_found", "Endpoint not found.", 404)
@app.errorhandler(405)
def _405(_): return fail("method_not_allowed", "Method not allowed.", 405)
@app.errorhandler(Exception)
def _500(e):
    app.logger.exception(e)
    return fail("server_error", "Something went wrong on our side. Please try again.", 500)


# ---------- knowledge base matching ----------
def tokens(text):
    return {w for w in re.findall(r"[a-z0-9']+", text.lower()) if w not in STOP and len(w) > 1}

def rank(message, limit=3):
    low, toks, scored = message.lower(), tokens(message), []
    for e in KB:
        s = sum(3 + len(k.split()) for k in e["keywords"] if k in low)
        s += len(toks & tokens(e["question"])) + 0.5 * len(toks & tokens(" ".join(e["keywords"])))
        if s > 0:
            scored.append((s, e))
    return sorted(scored, key=lambda x: -x[0])[:limit]

SENSITIVE = re.compile(r"(my password is|password:|passcode is|token\s*[:=]|otp\s*[:=]|\b\d{6}\b\s*is my otp)", re.I)
GREETING = re.compile(r"^\s*(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you)\b", re.I)

def faq_reply(message):
    if SENSITIVE.search(message):
        return {"reply": "For your safety, please **don't share passwords, OTPs or tokens** with me or anyone else. I never need them. Tell me what happens when you try to sign in and I'll guide you.",
                "source": "safety", "suggestions": ["How can I reset my password?"], "escalate": False}
    if GREETING.match(message) and len(message.split()) <= 4:
        return {"reply": "Hi! I'm your LMS Support Assistant. Tell me what's going wrong, or pick a topic below.",
                "source": "greeting", "suggestions": DEFAULT_SUGGESTIONS, "escalate": False}
    if re.search(r"\b(human|agent|support team|contact support|talk to (a )?person|helpdesk)\b", message, re.I):
        return {"reply": "Of course. Use **Contact support** to send the team your details. Include your course name and any error message you see.",
                "source": "escalation", "suggestions": [], "escalate": True}
    ranked = rank(message)
    if ranked and ranked[0][0] >= 3:
        e = ranked[0][1]
        return {"reply": e["answer"], "source": "faq:" + e["id"], "suggestions": e.get("followups", []), "escalate": False}
    return {"reply": "I'm not sure I understood that. To help me, could you tell me:\n1. Are you a **student, teacher or administrator**?\n2. What were you trying to do?\n3. What **exact error message** do you see?\n\nI can't verify account-specific details, so if this keeps happening our support team can look into it directly.",
            "source": "fallback", "suggestions": DEFAULT_SUGGESTIONS, "escalate": True}


# ---------- optional LLM ----------
def ai_reply(message, history):
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key:
        return None
    try:
        import anthropic
        context = "\n\n".join(f"Q: {e['question']}\nA: {e['answer']}" for _, e in rank(message, 3))
        msgs = [{"role": h["role"], "content": h["content"][:2000]} for h in history[-10:]
                if h.get("role") in ("user", "assistant") and isinstance(h.get("content"), str) and h["content"].strip()]
        while msgs and msgs[0]["role"] != "user":
            msgs.pop(0)
        if msgs and msgs[-1]["role"] == "user":
            msgs.pop()
        msgs.append({"role": "user", "content": message})
        r = anthropic.Anthropic(api_key=key).messages.create(
            model=MODEL, max_tokens=700, system=f"{SYSTEM_PROMPT}\n\nKNOWLEDGE BASE:\n{context or '(no matching entries)'}", messages=msgs)
        text = "".join(b.text for b in r.content if getattr(b, "type", "") == "text").strip()
        return text or None
    except Exception as exc:  # fall back to FAQ mode on any AI failure
        app.logger.warning("AI call failed, using FAQ fallback: %s", exc)
        return None


# ---------- routes ----------
@app.get("/api/health")
def health():
    return ok({"status": "healthy", "mode": "ai" if os.getenv("ANTHROPIC_API_KEY") else "faq", "time": now()})

@app.get("/api/faqs")
def faqs():
    rows = db().execute("SELECT id, category, question, answer FROM faqs ORDER BY category, question").fetchall()
    return ok({"faqs": [dict(r) for r in rows]})

@app.post("/api/chat")
def chat():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return fail("invalid_json", "Request body must be valid JSON.")
    message = body.get("message")
    if not isinstance(message, str) or not message.strip():
        return fail("invalid_message", "Please type a message.")
    if len(message) > 2000:
        return fail("message_too_long", "Messages are limited to 2000 characters.")
    history = body.get("history") if isinstance(body.get("history"), list) else []
    history = [h for h in history if isinstance(h, dict)]
    message = message.strip()

    result = faq_reply(message)
    mode = "faq"
    if result["source"] in ("fallback",) or result["source"].startswith("faq:"):
        text = ai_reply(message, history)
        if text:
            result["reply"], mode = text, "ai"
            if result["source"] == "fallback":
                result["escalate"] = True

    cid = body.get("conversation_id") if isinstance(body.get("conversation_id"), str) else None
    cid = (cid or uuid.uuid4().hex)[:64]
    conn = db()
    conn.execute("INSERT OR IGNORE INTO conversations(id,title,created_at) VALUES(?,?,?)", (cid, message[:60], now()))
    conn.execute("UPDATE conversations SET message_count = message_count + 2 WHERE id=?", (cid,))
    conn.commit()
    return ok({"conversation_id": cid, "message_id": uuid.uuid4().hex, "mode": mode, **result})

@app.post("/api/feedback")
def feedback():
    b = request.get_json(silent=True)
    if not isinstance(b, dict):
        return fail("invalid_json", "Request body must be valid JSON.")
    rating = b.get("rating")
    unresolved = bool(b.get("unresolved"))
    if rating not in ("up", "down", None) or (rating is None and not unresolved):
        return fail("invalid_rating", "Rating must be 'up' or 'down', or mark the issue as unresolved.")
    comment = str(b.get("comment") or "")[:1000]
    conn = db()
    conn.execute("INSERT INTO feedback(conversation_id,message_id,rating,comment,unresolved,created_at) VALUES(?,?,?,?,?,?)",
                 (str(b.get("conversation_id") or "")[:64], str(b.get("message_id") or "")[:64], rating, comment, int(unresolved), now()))
    conn.commit()
    return ok({"saved": True}, 201)

@app.post("/api/escalate")
def escalate():
    b = request.get_json(silent=True)
    if not isinstance(b, dict):
        return fail("invalid_json", "Request body must be valid JSON.")
    name, email, desc = (str(b.get(k) or "").strip() for k in ("name", "email", "description"))
    if not name or len(name) > 100:
        return fail("invalid_name", "Please enter your name.")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return fail("invalid_email", "Please enter a valid email address.")
    if len(desc) < 10 or len(desc) > 2000:
        return fail("invalid_description", "Please describe the issue in at least 10 characters (max 2000).")
    if SENSITIVE.search(desc):
        return fail("sensitive_data", "Please remove passwords or tokens from your message.")
    conn = db()
    cur = conn.execute("INSERT INTO escalations(name,email,category,description,conversation_id,created_at) VALUES(?,?,?,?,?,?)",
                       (name, email, str(b.get("category") or "General")[:50], desc, str(b.get("conversation_id") or "")[:64], now()))
    conn.commit()
    return ok({"ticket": f"LMS-{cur.lastrowid:05d}"}, 201)

init_db()
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", 5000)), debug=os.getenv("FLASK_DEBUG") == "1")
