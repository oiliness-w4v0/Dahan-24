import { Hono } from "hono";

const nfc = new Hono();

// --- 配置部分 ---
const CONFIG = {
  appId: import.meta.env.WECHAT_APPID,
  appSecret: import.meta.env.WECHAT_APPSECRET,
};

// 检查配置是否遗漏
if (!CONFIG.appId || !CONFIG.appSecret) {
  console.error("❌ 错误：请在配置中设置 appId 和 appSecret");
}

// --- 内存缓存 (Access Token) ---
const cache = {
  token: "",
  expiresAt: 0,
};

/**
 * 获取微信 AccessToken (带缓存及自动刷新)
 */
async function getAccessToken() {
  const now = Date.now();
  // 如果缓存有效（提前5分钟刷新），直接返回
  if (cache.token && now < cache.expiresAt) {
    return cache.token;
  }

  console.log("🔄 AccessToken 已过期或不存在，正在从微信服务器获取...");
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${CONFIG.appId}&secret=${CONFIG.appSecret}`;

  const resp = await fetch(url);
  const data: any = await resp.json();

  if (data.errcode || !data.access_token) {
    throw new Error(`获取 Token 失败: ${data.errmsg || "未知错误"}`);
  }

  // 设置过期时间 (微信返回秒，转换为毫秒，提前 5 分钟刷新)
  cache.token = data.access_token;
  cache.expiresAt = now + (data.expires_in - 300) * 1000;
  console.log("✅ Token 获取成功");

  return cache.token;
}

/**
 * 调用微信接口生成 URL Scheme
 */
async function generateScheme(path: string = "pages/index/index", query: string = "") {
  try {
    const token = await getAccessToken();
    const url = `https://api.weixin.qq.com/wxa/generatescheme?access_token=${token}`;

    const payload = {
      "jump_wxa": {
        "path": path,
        "query": query,
        "env_version": "release" // release=正式版, trial=体验版, develop=开发版
      },
      "is_expire": true,    // 必须设置过期，除非是企业主体
      "expire_type": 1,     // 1: 按天数
      "expire_interval": 30 // 30天后失效
    };

    const resp = await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });

    const data: any = await resp.json();
    if (data.errcode !== 0) {
      throw new Error(`Scheme 生成失败: ${data.errmsg}`);
    }

    return data.openlink; // 返回 weixin://dl/business/?t=...
  } catch (error) {
    console.error(error);
    return null;
  }
}

// 路由 1: 供 NFC 标签使用的跳转页
// 访问地址: http://你的IP:5175/api/nfc?path=pages/welcome/welcome
nfc.get("/nfc", async (c) => {
  const path = c.req.query("path") || "pages/index/index";
  const query = c.req.query("query") || "";

  // 实时生成一个新的 Scheme (也可以改为从数据库读取固定的)
  const openLink = await generateScheme(path, query);

  if (!openLink) {
    return c.text("生成跳转链接失败，请检查后台日志。", 500);
  }

  // 返回 HTML 页面，包含自动跳转 JS
  const html = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
    <title>正在跳转...</title>
    <style>
      body { background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 90%; width: 300px; }
      h2 { margin-top: 0; color: #333; font-size: 18px; }
      p { color: #666; font-size: 14px; margin-bottom: 24px; }
      .btn { display: block; width: 100%; padding: 14px 0; background-color: #07c160; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; border: none; cursor: pointer; }
      .btn:active { background-color: #06ad56; }
      .footer { margin-top: 20px; font-size: 12px; color: #999; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>即将打开微信小程序</h2>
      <p>如果未自动跳转，请点击下方按钮</p>
      <!-- 核心跳转链接 -->
      <a id="jumpBtn" href="${openLink}" class="btn">打开小程序</a>
    </div>
    <div class="footer">Powered by Bun NFC Service</div>

    <script>
      // 页面加载后尝试自动跳转
      window.onload = function() {
        // 延迟 100ms 确保页面渲染完成，提升体验
        setTimeout(function() {
          window.location.replace("${openLink}");
        }, 100);
      };

      // 监听页面可见性变化 (主要解决用户从微信切回来后的体验)
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
          // 再次尝试跳转，或者提示用户点击
          console.log('Page visible');
        }
      });
    </script>
  </body>
  </html>
  `;

  return c.html(html);
});

// 路由 2: 纯 JSON API (用于调试)
nfc.get("/url", async (c) => {
  const path = c.req.query("path") || "pages/index/index";
  const link = await generateScheme(path);
  return c.json({ success: !!link, link });
});

export default nfc;
