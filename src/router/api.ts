import { Hono } from "hono";

const api = new Hono();

// API 路由组：放置所有 /api/* 相关的接口
// 重要：这里使用相对路径挂载在主应用中（在 index.ts 使用 app.route('/api', api)）
api.get("/", (c) => c.text("Hello Bun!"));

export default api;
