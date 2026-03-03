import { Router } from "express";
import db from "./db.ts";

const router = Router();

router.get("/conversations", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM conversations ORDER BY created_at DESC").all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get("/conversations/:id", (req, res) => {
  try {
    const messages = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(req.params.id);
    const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
    res.json({ ...conversation, messages });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/conversations", (req, res) => {
  const { id, title } = req.body;
  try {
    db.prepare("INSERT INTO conversations (id, title) VALUES (?, ?)").run(id, title);
    res.status(201).json({ id, title });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/messages", (req, res) => {
  const { conversation_id, role, content } = req.body;
  try {
    const result = db.prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)").run(conversation_id, role, content);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.patch("/conversations/:id", (req, res) => {
  const { title, summary } = req.body;
  try {
    if (title !== undefined) db.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(title, req.params.id);
    if (summary !== undefined) db.prepare("UPDATE conversations SET summary = ? WHERE id = ?").run(summary, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete("/conversations/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM conversations WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
