import os, tempfile, unittest
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["ANTHROPIC_API_KEY"] = ""
import app as A

class Api(unittest.TestCase):
    def setUp(self): self.c = A.app.test_client()
    def chat(self, m): return self.c.post("/api/chat", json={"message": m})

    def test_health(self): self.assertEqual(self.c.get("/api/health").json["data"]["status"], "healthy")
    def test_faqs(self): self.assertGreater(len(self.c.get("/api/faqs").json["data"]["faqs"]), 10)
    def test_samples(self):
        expect = {"I cannot log in to my LMS account. What should I do?": "login-error", "How do I submit an assignment?": "submit-assignment",
                  "Why can't I access my enrolled course?": "course-access", "My lecture video is not playing.": "video",
                  "How can I reset my password?": "reset-password", "Where can I find my exam results?": "results",
                  "How do I upload study materials as a teacher?": "faculty-upload"}
        for q, src in expect.items():
            self.assertEqual(self.chat(q).json["data"]["source"], "faq:" + src, q)
    def test_validation(self):
        self.assertEqual(self.chat("   ").status_code, 400)
        self.assertEqual(self.chat("x" * 2001).status_code, 400)
        self.assertEqual(self.c.post("/api/chat", data="nope").status_code, 400)
    def test_fallback_escalates(self): self.assertTrue(self.chat("blorp zzz").json["data"]["escalate"])
    def test_sensitive(self): self.assertEqual(self.chat("my password is hunter2").json["data"]["source"], "safety")
    def test_feedback(self):
        self.assertEqual(self.c.post("/api/feedback", json={"rating": "up"}).status_code, 201)
        self.assertEqual(self.c.post("/api/feedback", json={"rating": "meh"}).status_code, 400)
    def test_escalate(self):
        r = self.c.post("/api/escalate", json={"name": "A", "email": "a@b.co", "description": "Cannot open my course page"})
        self.assertTrue(r.json["data"]["ticket"].startswith("LMS-"))
        self.assertEqual(self.c.post("/api/escalate", json={"name": "A", "email": "bad", "description": "long enough text"}).status_code, 400)

if __name__ == "__main__": unittest.main()
