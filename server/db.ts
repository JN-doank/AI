import Database from "better-sqlite3";
import path from "path";

// Vercel hanya mengizinkan penulisan file di folder /tmp
const dbPath = process.env.VERCEL ? path.join("/tmp", "chat_memory.db") : "chat_memory.db";
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY, title TEXT, summary TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT, role TEXT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );
`);

export default db;
