#!/bin/bash

# 部署脚本 - 使用 PM2 常驻运行

echo "=========================================="
echo "Dahan-24 部署脚本"
echo "=========================================="

# 1. 检查环境
echo "📋 检查环境..."

if ! command -v bun &> /dev/null; then
    echo "❌ Bun 未安装，请先安装 Bun"
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
fi

# 2. 安装依赖
echo "📦 安装依赖..."
bun install

# 3. 创建日志目录
echo "📁 创建日志目录..."
mkdir -p logs

# 4. 停止旧进程（如果存在）
echo "🛑 停止旧进程..."
pm2 stop dahan-24 2>/dev/null || true
pm2 delete dahan-24 2>/dev/null || true

# 5. 启动应用
echo "🚀 启动应用..."
pm2 start ecosystem.config.cjs

# 6. 保存 PM2 配置
echo "💾 保存 PM2 配置..."
pm2 save

# 7. 设置开机自启
echo "⚙️  设置开机自启..."
pm2 startup | grep -E "sudo|pm2 startup" || echo "开机自启已配置或需要手动执行"

# 8. 显示状态
echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
pm2 status
echo ""
echo "📊 查看日志: bun run pm2:logs"
echo "📈 监控面板: bun run pm2:monit"
echo "🔄 重启服务: bun run pm2:restart"
echo "⏹️  停止服务: bun run pm2:stop"
echo ""
