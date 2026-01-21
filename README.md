# dahan-24

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

---

## 生产环境部署指南

### 快速部署（使用 PM2）

**Linux/Mac:**
```bash
# 1. 给脚本添加执行权限
chmod +x deploy.sh

# 2. 运行部署脚本
./deploy.sh
```

**Windows:**
```bash
# 运行部署脚本
deploy.bat
```

### 手动部署

```bash
# 1. 安装 PM2
npm install -g pm2

# 2. 安装依赖
bun install

# 3. 创建日志目录
mkdir -p logs

# 4. 启动应用
bun run pm2:start

# 5. 保存 PM2 配置
pm2 save

# 6. 设置开机自启（首次需要）
pm2 startup
```

### PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
bun run pm2:logs

# 实时监控
bun run pm2:monit

# 重启服务
bun run pm2:restart

# 停止服务
bun run pm2:stop
```

### 环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

- `PORT`: 服务器端口（默认: 5174）
- `NODE_ENV`: 运行环境（production/development）
- `REMOTE_SERVER`: 远程服务器地址
