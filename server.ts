import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inisialisasi Database
const db = new Database("chat_memory.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,
    role TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );
`);

const app = express();
app.use(express.json());

// API Routes
app.get("/api/conversations", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM conversations ORDER BY created_at DESC").all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/conversations/:id", (req, res) => {
  try {
    const messages = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(req.params.id);
    const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
    res.json({ ...conversation, messages });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/conversations", (req, res) => {
  const { id, title } = req.body;
  try {
    db.prepare("INSERT INTO conversations (id, title) VALUES (?, ?)").run(id, title);
    res.status(201).json({ id, title });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/messages", (req, res) => {
  const { conversation_id, role, content } = req.body;
  try {
    const result = db.prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)").run(conversation_id, role, content);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch("/api/conversations/:id", (req, res) => {
  const { title, summary } = req.body;
  try {
    if (title !== undefined) db.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(title, req.params.id);
    if (summary !== undefined) db.prepare("UPDATE conversations SET summary = ? WHERE id = ?").run(summary, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete("/api/conversations/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM conversations WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
    app.listen(3000, "0.0.0.0", () => console.log("Server running on http://localhost:3000"));
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }
}

startServer();
export default app;
