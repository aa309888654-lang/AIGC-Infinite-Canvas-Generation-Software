/**
 * PM2 ecosystem 配置 - 小天 AICG Studio 后端
 *
 * 使用方式：
 *   pm2 start ecosystem.config.js --env production
 *   pm2 restart ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production
 *
 * 关键点：
 *   - cwd 必须指向 backend 目录，确保正确加载 .env
 *   - 使用 --env production 切换到生产环境
 *   - 自动重启策略：最大10次重启，间隔30秒
 *
 * P2 修复 #23：日志轮转
 *   PM2 原生不支持按大小/时间轮转，需安装 pm2-logrotate 模块。
 *   首次部署执行：npm run setup:logrotate
 *   或手动执行：
 *     pm2 install pm2-logrotate
 *     pm2 set pm2-logrotate:max_size 10M        # 单文件超过 10MB 时轮转
 *     pm2 set pm2-logrotate:retain 30           # 保留最近 30 个轮转文件
 *     pm2 set pm2-logrotate:compress true       # 旧日志 gzip 压缩
 *     pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
 *     pm2 set pm2-logrotate:workerInterval 30   # 检查间隔（秒）
 *     pm2 set pm2-logrotate:rotateInterval '0 * * * *'  # 每小时强制轮转
 */
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 30000,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // 日志配置
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 内存阈值自动重启（512MB）
      max_memory_restart: '512M',
    },
  ],
};
