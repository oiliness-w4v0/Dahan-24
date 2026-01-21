import { Hono } from "hono";
import db from "../db/sqlite";

const app = new Hono();

// 创建/更新 JSON (通过 key)
// 注意：路由路径为 /json/:key，后端服务器会添加 /api 前缀
// 实际访问路径为：/api/json/:key
app.put("/json/:key", async (c) => {
  const key = c.req.param("key");
  const value = await c.req.json();

  console.log(`[jsonStore] PUT /json/${key}`, value);

  if (!key) {
    return c.json({ error: "Key is required" }, 400);
  }

  const valueString = JSON.stringify(value);

  try {
    const query = db.query(`
      INSERT INTO json_store (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    query.run(key, valueString);

    console.log(`[jsonStore] Successfully stored key: ${key}`);
    return c.json({
      success: true,
      key,
      value
    });
  } catch (error) {
    console.error(`[jsonStore] Failed to store key: ${key}`, error);
    return c.json({ error: "Failed to store JSON" }, 500);
  }
});

// 获取 JSON (通过 key)
// 注意：路由路径为 /json/:key，后端服务器会添加 /api 前缀
// 实际访问路径为：/api/json/:key
app.get("/json/:key", (c) => {
  const key = c.req.param("key");
  console.log(`[jsonStore] GET /json/${key}`);
  console.log("[jsonStore] Params:", c.req.param());

  const query = db.query("SELECT value FROM json_store WHERE key = ?");
  const result = query.get(key) as { value: string } | undefined;

  if (!result) {
    console.log(`[jsonStore] Key not found: ${key}, returning null`);
    return c.json({
      success: true,
      key,
      value: null
    });
  }

  try {
    const value = JSON.parse(result.value);
    console.log(`[jsonStore] Successfully retrieved key: ${key}`);
    return c.json({
      success: true,
      key,
      value
    });
  } catch (error) {
    console.error(`[jsonStore] Failed to parse JSON for key: ${key}`, error);
    return c.json({ error: "Failed to parse JSON" }, 500);
  }
});

// 删除 JSON (通过 key)
// 注意：路由路径为 /json/:key，后端服务器会添加 /api 前缀
// 实际访问路径为：/api/json/:key
app.delete("/json/:key", (c) => {
  const key = c.req.param("key");
  console.log(`[jsonStore] DELETE /json/${key}`);

  const query = db.query("DELETE FROM json_store WHERE key = ?");
  const result = query.run(key);

  if (result.changes === 0) {
    console.log(`[jsonStore] Key not found for deletion: ${key}`);
    return c.json({ error: "Key not found" }, 404);
  }

  console.log(`[jsonStore] Successfully deleted key: ${key}`);
  return c.json({
    success: true,
    message: `Key '${key}' deleted successfully`
  });
});

// 列出所有 keys
app.get("/json", (c) => {
  const query = db.query(`
    SELECT key, created_at, updated_at
    FROM json_store
    ORDER BY updated_at DESC
  `);

  const results = query.all() as Array<{
    key: string;
    created_at: string;
    updated_at: string;
  }>;

  return c.json({
    success: true,
    count: results.length,
    data: results
  });
});

export default app;
