import { Hono } from "hono";
import { serveStatic } from "hono/bun";

import api from "./router/api";
import ping from "./router/ping";
import generateImage from "./router/generateImage";
import nfc from "./router/nfc";

const app = new Hono();

// ----------------
// API 路由组（挂载在 /api 下）
// - `api` 提供基础 GET /api/ 的响应
// - 其余 router 模块提供子路径（例如 /api/ping, /api/generate, /api/nfc）
// 挂载顺序：先挂具体路由，再挂静态资源
// ----------------
app.route("/api", api); // GET /api/ -> Hello Bun!
app.route("/api", ping); // GET /api/ping
app.route("/api", generateImage); // POST /api/generate
app.route("/api", nfc); // GET /api/nfc

// Serve static files from ./dist for all other routes
app.use("/*", serveStatic({ root: "./dist/" }));

export default {
  port: import.meta.env.PORT ? Number(import.meta.env.PORT) : 5174,
  fetch: app.fetch,
};
