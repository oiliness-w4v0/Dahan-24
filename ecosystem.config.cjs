module.exports = {
  apps: [
    {
      name: 'dahan-24',
      script: 'src/index.ts',
      interpreter: 'bun',
      interpreter_args: 'run',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5174
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5174
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 进程管理
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      // 自动重启策略
      exp_backoff_restart_delay: 100,
      // 监听文件变化（生产环境建议关闭）
      watch_delay: 1000,
      // 忽略的文件
      ignore_watch: [
        'node_modules',
        'logs',
        'dist',
        'build',
        '.git'
      ]
    }
  ]
};
