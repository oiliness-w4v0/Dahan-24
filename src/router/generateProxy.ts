import { Hono } from "hono";

const app = new Hono();

// 远程服务器配置
const REMOTE_SERVER = "http://101.35.246.159";
const REMOTE_PATH = "/api/generate";

// POST /generate-proxy -> 代理到远程服务器的 /api/generate
app.post("/generate-proxy", async (c) => {
  try {
    // 获取原始请求体
    const body = await c.req.json();

    console.log(`[Proxy] Forwarding request to ${REMOTE_SERVER}${REMOTE_PATH}`);

    // 转发请求到远程服务器
    const response = await fetch(`${REMOTE_SERVER}${REMOTE_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 转发其他可能的 headers
        ...(c.req.header("authorization") && {
          Authorization: c.req.header("authorization")!,
        }),
      },
      body: JSON.stringify(body),
    });

    // 检查响应状态
    if (!response.ok) {
      console.error(`[Proxy] Remote server returned ${response.status}`);
      return c.json(
        {
          error: "Remote server error",
          status: response.status,
          statusText: response.statusText,
        },
        response.status,
      );
    }

    // 获取响应数据
    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      // JSON 响应
      const json = await response.json();
      return c.json(json);
    } else if (contentType?.includes("image")) {
      // 图片响应（从 /api/generate 返回的图片）
      const buffer = await response.arrayBuffer();
      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": response.headers.get("Content-Disposition") ||
            'attachment; filename="generated.png"',
        },
      });
    } else {
      // 其他类型的响应
      const text = await response.text();
      return new Response(text, {
        status: response.status,
        headers: {
          "Content-Type": contentType || "text/plain",
        },
      });
    }
  } catch (error: any) {
    console.error(`[Proxy] Request failed:`, error.message);
    return c.json(
      {
        error: "Proxy request failed",
        details: error.message,
      },
      500,
    );
  }
});

export default app;
