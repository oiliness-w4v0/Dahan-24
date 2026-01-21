import { Hono } from "hono";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import * as os from "os";

const gen = new Hono();

// 图片缓存目录
const CACHE_DIR = path.join(process.cwd(), ".image-cache");

// 确保目录可写
function ensureDir(dir: string): void {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }
    // 测试写权限
    fs.accessSync(dir, fs.constants.W_OK);
  } catch (error: any) {
    throw new Error(`Cannot write to directory: ${dir}. Error: ${error.message}`);
  }
}

try {
  ensureDir(CACHE_DIR);
} catch (error: any) {
  console.error(`[Cache] Failed to create cache directory:`, error);
  // 尝试使用系统临时目录作为备选
  const tmpDir = path.join(os.tmpdir(), "dahan-image-cache");
  console.warn(`[Cache] Falling back to temp directory: ${tmpDir}`);
  try {
    ensureDir(tmpDir);
  } catch (fallbackError) {
    console.error(`[Cache] Failed to create fallback cache directory:`, fallbackError);
  }
}

// 本地字体目录（src/lib）
const FONTS_DIR = path.join(process.cwd(), "src", "lib");

// 扫描本地字体文件
const localFonts = new Map<string, string>();
if (fs.existsSync(FONTS_DIR)) {
  const fontFiles = fs
    .readdirSync(FONTS_DIR)
    .filter((f) => /\.(ttf|otf|woff|woff2)$/i.test(f));
  for (const fontFile of fontFiles) {
    const fontPath = path.join(FONTS_DIR, fontFile);
    const fontName = path.basename(fontFile, path.extname(fontFile));
    localFonts.set(fontName.toLowerCase(), fontPath);
    console.log(`[Fonts] Loaded local font: ${fontName} -> ${fontPath}`);
  }
}
console.log(`[Fonts] Total local fonts loaded: ${localFonts.size}`);

// 图片缓存映射（URL -> 本地文件路径）
const imageCache = new Map<string, string>();

// 获取本地字体的 Base64 编码
function getLocalFontAsBase64(fontName: string): string | null {
  const normalizedName = fontName.toLowerCase().replace(/\s+/g, "");
  console.log(`[Fonts] Looking for font: "${normalizedName}"`);

  // 精确匹配
  if (localFonts.has(normalizedName)) {
    const fontPath = localFonts.get(normalizedName)!;
    try {
      const buffer = fs.readFileSync(fontPath);
      const ext = path.extname(fontPath).toLowerCase();
      let mimeType = "font/ttf";
      if (ext === ".otf") mimeType = "font/otf";
      else if (ext === ".woff") mimeType = "font/woff";
      else if (ext === ".woff2") mimeType = "font/woff2";

      const base64 = buffer.toString("base64");
      console.log(
        `[Fonts] Found and encoded: ${fontName} (${buffer.length} bytes)`,
      );
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error(`[Fonts] Failed to read font file:`, error);
    }
  }

  // 模糊匹配
  for (const [name, fontPath] of localFonts) {
    if (name.includes(normalizedName) || normalizedName.includes(name)) {
      try {
        const buffer = fs.readFileSync(fontPath);
        const ext = path.extname(fontPath).toLowerCase();
        let mimeType = "font/ttf";
        if (ext === ".otf") mimeType = "font/otf";
        else if (ext === ".woff") mimeType = "font/woff";
        else if (ext === ".woff2") mimeType = "font/woff2";

        const base64 = buffer.toString("base64");
        console.log(
          `[Fonts] Fuzzy matched: "${name}" for request "${fontName}"`,
        );
        return `data:${mimeType};base64,${base64}`;
      } catch (error) {
        console.error(`[Fonts] Failed to read font file:`, error);
      }
    }
  }

  console.warn(`[Fonts] Not found: ${fontName}, using fallback font`);
  return null;
}

// Type definitions for elements used to render the image
type TextElement = {
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: string;
  lineHeight?: number;
  content?: string;
  customFontUrl?: string;
  writingMode?: string;
  letterSpacing?: number;
};

type ImageElement = {
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  src?: string;
};

type ElementDef = TextElement | ImageElement;

// 浏览器实例池（避免每次请求都启动新浏览器）
let browserInstance: any = null;
let initPromise: Promise<any> | null = null;

// 下载并缓存图片
async function cacheImage(url: string): Promise<string> {
  // 检查内存缓存
  if (imageCache.has(url)) {
    console.log(`[Cache] HIT: ${url.substring(0, 50)}...`);
    return imageCache.get(url)!;
  }

  // 生成缓存文件名（使用URL的MD5哈希）
  const urlHash = createHash("md5").update(url).digest("hex");

  // 更健壮的扩展名提取
  let ext = "png";
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const lastDot = pathname.lastIndexOf(".");
    if (lastDot > 0) {
      const extractedExt = pathname.slice(lastDot + 1).toLowerCase();
      // 只接受常见的图片扩展名
      if (/^(png|jpe?g|gif|webp|bmp|svg)$/i.test(extractedExt)) {
        ext = extractedExt;
      }
    }
  } catch (e) {
    console.warn(`[Cache] Failed to parse URL, using default extension: ${ext}`);
  }

  // 确定使用的缓存目录
  let cacheDir = CACHE_DIR;
  try {
    fs.accessSync(cacheDir, fs.constants.W_OK);
  } catch {
    // 如果主目录不可写，使用临时目录
    cacheDir = path.join(os.tmpdir(), "dahan-image-cache");
    ensureDir(cacheDir);
  }

  const cachePath = path.join(cacheDir, `${urlHash}.${ext}`);

  // 检查文件是否已存在
  if (fs.existsSync(cachePath)) {
    console.log(
      `[Cache] DISK HIT: ${url.substring(0, 50)}... -> ${path.basename(cachePath)}`,
    );
    imageCache.set(url, cachePath);
    return cachePath;
  }

  // 下载图片
  console.log(`[Cache] DOWNLOADING: ${url.substring(0, 50)}...`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(cachePath, Buffer.from(buffer));

    console.log(
      `[Cache] DOWNLOADED: ${path.basename(cachePath)} (${buffer.byteLength} bytes)`,
    );
    imageCache.set(url, cachePath);
    return cachePath;
  } catch (error: any) {
    console.error(`[Cache] FAILED: ${error.message}`);
    // 下载失败，返回原始URL
    return url;
  }
}

// 查找系统中的 Chromium/Chrome 可执行文件
function findExecutablePath(): string | undefined {
  const platform = process.platform;

  if (platform === "win32") {
    // Windows: 尝试多个常见路径
    const windowsPaths = [
      process.env.CHROME_PATH, // 环境变量优先
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
      process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    ].filter(Boolean) as string[];

    for (const p of windowsPaths) {
      if (p && fs.existsSync(p)) {
        console.log(`[Puppeteer] Found Chrome at: ${p}`);
        return p;
      }
    }
  } else if (platform === "linux") {
    // Linux: 常见的 Chromium/Chrome 安装路径
    const linuxPaths = [
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome-beta",
      "/snap/bin/chromium",
      "/opt/google/chrome/chrome",
    ];

    for (const p of linuxPaths) {
      if (fs.existsSync(p)) {
        console.log(`[Puppeteer] Found browser at: ${p}`);
        return p;
      }
    }
  } else if (platform === "darwin") {
    // macOS
    const macPaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];

    for (const p of macPaths) {
      if (fs.existsSync(p)) {
        console.log(`[Puppeteer] Found browser at: ${p}`);
        return p;
      }
    }
  }

  return undefined;
}

// 获取或创建浏览器实例
async function getBrowser(): Promise<any> {
  // 如果已有实例且已初始化，直接返回
  if (browserInstance) return browserInstance;

  // 如果正在初始化，等待初始化完成
  if (initPromise) return initPromise;

  // 开始初始化
  initPromise = (async () => {
    try {
      // 动态导入，优先 puppeteer-core（更轻量），回退 puppeteer
      let puppeteerMod: any = null;
      try {
        puppeteerMod = await import("puppeteer-core");
      } catch (e) {
        try {
          puppeteerMod = await import("puppeteer");
        } catch (e2) {
          throw new Error("puppeteer or puppeteer-core not installed");
        }
      }

      const puppeteer = puppeteerMod.default || puppeteerMod;

      // 平台检测
      const platform = process.platform;
      const launchOptions: any = {
        headless: "new", // 使用新版 headless 模式
        timeout: 60000, // 增加启动超时时间到 60 秒
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // 解决 /dev/shm 空间不足
          "--disable-gpu", // 某些 Linux 环境需要
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-default-apps",
          "--disable-sync",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-first-run",
          "--safebrowsing-disable-auto-update",
          "--disable-translate",
          "--disable-software-rasterizer",
          "--disable-web-security", // 允许跨域加载本地资源
          "--allow-file-access-from-files", // 允许文件协议访问
        ],
      };

      // 根据平台设置可执行文件路径
      const executablePath = findExecutablePath();
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      } else {
        console.warn(`[Puppeteer] No browser found in system paths, relying on Puppeteer's bundled browser`);
      }

      console.log(`[Puppeteer] Launching browser on platform: ${platform}`);
      if (executablePath) {
        console.log(`[Puppeteer] Executable: ${executablePath}`);
      }
      console.log(`[Puppeteer] Launch options timeout: ${launchOptions.timeout}ms`);

      browserInstance = await puppeteer.launch(launchOptions);
      console.log("[Puppeteer] Browser launched successfully");

      return browserInstance;
    } catch (error: any) {
      console.error("[Puppeteer] Failed to launch browser:", error.message);

      // 提供更有用的错误信息
      if (process.platform === "linux") {
        console.error(`
[Puppeteer] Linux troubleshooting:
1. Install Chromium/Chrome:
   sudo apt-get update
   sudo apt-get install -y chromium-browser

2. Or install Chrome:
   wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
   sudo dpkg -i google-chrome-stable_current_amd64.deb
   sudo apt-get install -f

3. Check if browser is installed:
   which chromium-browser
   which google-chrome

4. Check missing dependencies:
   ldd $(which chromium-browser) | grep "not found"

5. Install missing dependencies:
   sudo apt-get install -y \\
     libnss3 \\
     libatk1.0-0 \\
     libatk-bridge2.0-0 \\
     libcups2 \\
     libdrm2 \\
     libdbus-1-3 \\
     libxkbcommon0 \\
     libxcomposite1 \\
     libxdamage1 \\
     libxfixes3 \\
     libxrandr2 \\
     libgbm1 \\
     libasound2

6. Try using Puppeteer's bundled Chromium:
   npm install puppeteer

7. Check system resources:
   free -h  # Available memory
   df -h   # Disk space
`);
      }

      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

// POST /generate -> generate image
// 重要：动态导入 puppeteer 或 puppeteer-core，避免在所有环境强制安装
// 路径为 /api/generate（在主应用中以 app.route('/api', generateImage) 挂载）
gen.post("/generate", async (c) => {
  let page: any = null;
  const startTime = Date.now();

  try {
    // 获取浏览器实例
    const browser = await getBrowser();

    // 解析请求体（宽度、高度、元素列表）并使用明确类型
    const body = (await c.req.json()) as {
      width?: number;
      height?: number;
      elements?: ElementDef[];
    };
    const { width = 750, height = 1334 } = body;
    const elements: ElementDef[] = body.elements ?? [];

    // 统计元素类型
    const imageCount = elements.filter((el) => el.type === "image").length;
    const textCount = elements.filter((el) => el.type === "text").length;
    const customFontCount = elements.filter(
      (el) => el.type === "text" && (el as TextElement).customFontUrl,
    ).length;

    console.log(`[Generate] Starting: ${width}x${height}`);
    console.log(
      `[Generate] Elements: ${elements.length} total (${imageCount} images, ${textCount} texts, ${customFontCount} custom fonts)`,
    );

    // 预处理：下载并缓存所有图片，处理字体
    console.log(`[Generate] Caching images...`);
    for (const el of elements) {
      if (el.type === "image" && (el as ImageElement).src) {
        const imgEl = el as ImageElement;
        const originalSrc = imgEl.src!;
        await cacheImage(originalSrc);
        // 保持原始 URL，不做 Base64 转换
        console.log(
          `[Generate] Image cached: ${originalSrc.substring(0, 50)}...`,
        );
      } else if (el.type === "text") {
        const textEl = el as TextElement;
        if (textEl.fontFamily) {
          console.log(`[Generate] Text uses font: ${textEl.fontFamily}`);
          // 使用本地字体
          const fontData = getLocalFontAsBase64(textEl.fontFamily);
          if (fontData) {
            // 将 Base64 数据存储在元素上，用于后续生成 HTML
            (textEl as any).localFontData = fontData;
          }
        }
        if (textEl.content) {
          console.log(
            `[Generate] Text: "${textEl.content}" (${textEl.fontSize}px, ${textEl.color})`,
          );
        }
      }
    }

    // 创建新页面
    page = await browser.newPage();

    // 监听页面控制台日志
    page.on("console", (msg: any) => {
      console.log(`[Browser] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    // 允许跨域加载本地资源
    await page.setBypassCSP(true);

    // 设置视口
    await page.setViewport({
      width: Math.round(width),
      height: Math.round(height),
      deviceScaleFactor: 2,
    });

    // 构建简单 HTML 用于截图
    const htmlContent = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;padding:0;background:white;overflow:hidden}
      .canvas{width:${width}px;height:${height}px;position:relative}
      .element{position:absolute;box-sizing:border-box}
      .text-inner{width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:pre-wrap;word-wrap:break-word;word-break:break-word}
      .text-inner.vertical{writing-mode:vertical-rl;text-orientation:upright}
      .image-inner{width:100%;height:100%;object-fit:contain;display:block}
      ${elements
        .filter(
          (el: ElementDef) =>
            el.type === "text" &&
            (el as TextElement).fontFamily &&
            (el as any).localFontData,
        )
        .map((el: ElementDef) => {
          const te = el as TextElement;
          return `@font-face{font-family:'${te.fontFamily}';src:url('${(te as any).localFontData}')}`;
        })
        .join("\n")}
    </style></head><body><div class="canvas">
    ${elements
      .map((el: ElementDef, i: number) => {
        const style = `left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;opacity:${el.opacity ?? 1};z-index:${i};`;
        if (el.type === "image" && (el as ImageElement).src)
          return `<div class="element" style="${style}"><img src="${(el as ImageElement).src}" class="image-inner" /></div>`;
        if (el.type === "text" && (el as TextElement).content) {
          const te = el as TextElement;
          const isVertical =
            te.writingMode === "vertical-rl" || te.writingMode === "vertical";

          // 对于竖排文字，letter-spacing 应该在 CSS 类中应用
          let textStyle = `font-size:${te.fontSize}px;color:${te.color};font-family:${te.fontFamily || "Arial, sans-serif"};font-weight:${te.fontWeight || "normal"};line-height:${te.lineHeight ?? 1.5};`;

          // 竖排和横排分别处理 letter-spacing
          if (isVertical) {
            // 竖排文字使用用户设置的间距，默认 0.2em
            const spacing =
              te.letterSpacing !== undefined
                ? `${te.letterSpacing}px`
                : "0.2em";
            textStyle += `letter-spacing:${spacing};`;
          } else {
            // 横排文字使用用户设置的间距，默认 0
            textStyle += `letter-spacing:${te.letterSpacing ?? 0}px;`;
          }

          const safeContent = String(te.content)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          const verticalClass = isVertical ? " vertical" : "";
          return `<div class="element" style="${style}"><div class="text-inner${verticalClass}" style="${textStyle}">${safeContent}</div></div>`;
        }
        return "";
      })
      .join("")}
    </div></body></html>`;

    // 渲染并截图
    await page.setContent(htmlContent, {
      waitUntil: "load",
      timeout: 60000,
    });

    console.log("[Generate] HTML content loaded, ready to take screenshot");

    // 额外等待确保字体完全渲染
    await new Promise((resolve) => setTimeout(resolve, 500));

    const buffer = await page.screenshot({
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: Math.round(width),
        height: Math.round(height),
      },
      omitBackground: false,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Generate] Completed in ${elapsed}ms`);

    return new Response(buffer as any, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="generated.png"',
      },
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Generate] Failed after ${elapsed}ms:`, error.message);
    return c.json({ error: "generate failed", details: String(error) }, 500);
  } finally {
    // 关闭页面而不是整个浏览器
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.error("[Generate] Failed to close page:", e);
      }
    }
  }
});

export default gen;
