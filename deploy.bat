@echo off
REM Windows 部署脚本

echo ==========================================
echo Dahan-24 部署脚本 (Windows)
echo ==========================================

REM 1. 检查环境
echo [1/5] 检查环境...
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo X Bun 未安装，请先安装 Bun
    pause
    exit /b 1
)

where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo 安装 PM2...
    call npm install -g pm2
)

REM 2. 安装依赖
echo [2/5] 安装依赖...
call bun install

REM 3. 创建日志目录
echo [3/5] 创建日志目录...
if not exist logs mkdir logs

REM 4. 停止旧进程
echo [4/5] 停止旧进程...
call pm2 stop dahan-24 2>nul
call pm2 delete dahan-24 2>nul

REM 5. 启动应用
echo [5/5] 启动应用...
call pm2 start ecosystem.config.cjs

REM 6. 保存配置
call pm2 save

echo.
echo ==========================================
echo 部署完成！
echo ==========================================
echo.
call pm2 status
echo.
echo 查看日志: bun run pm2:logs
echo 监控面板: bun run pm2:monit
echo 重启服务: bun run pm2:restart
echo 停止服务: bun run pm2:stop
echo.
pause
