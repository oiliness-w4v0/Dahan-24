import Database from "bun:sqlite";

const db = new Database("data.db");

// 创建 json_store 表
db.exec(`
  CREATE TABLE IF NOT EXISTS json_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建索引以提高查询性能
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_json_store_key ON json_store(key)
`);

export default db;
