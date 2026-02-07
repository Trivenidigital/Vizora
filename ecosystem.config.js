/**
 * PM2 Ecosystem Configuration for Vizora
 * Use: pm2 start ecosystem.config.js
 *
 * Production deployment with:
 * - Automatic restarts on crash
 * - Log management
 * - Cluster mode for middleware
 * - Memory limits
 * - Health monitoring
 */

module.exports = {
  apps: [
    {
      name: 'vizora-middleware',
      script: 'dist/main.js',
      cwd: './middleware',
      instances: process.env.NODE_ENV === 'production' ? 2 : 1, // 2 instances in prod
      exec_mode: process.env.NODE_ENV === 'production' ? 'cluster' : 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Graceful shutdown
      kill_timeout: 10000, // 10 seconds to gracefully shutdown
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '50M',
      error_file: './logs/middleware-error.log',
      out_file: './logs/middleware-out.log',
      merge_logs: true,
      // Restart policy
      exp_backoff_restart_delay: 100, // Exponential backoff
      max_restarts: 10,
      min_uptime: '10s', // Consider crash if restart within 10s
    },
    {
      name: 'vizora-realtime',
      script: 'dist/main.js',
      cwd: './realtime',
      instances: 1, // Single instance for WebSocket state consistency
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      // Graceful shutdown
      kill_timeout: 15000, // 15 seconds for WebSocket connections to close
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '50M',
      error_file: './logs/realtime-error.log',
      out_file: './logs/realtime-out.log',
      merge_logs: true,
      // Restart policy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'vizora-web',
      script: 'npm',
      args: 'start',
      cwd: './web',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Graceful shutdown
      kill_timeout: 10000,
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '50M',
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      merge_logs: true,
      // Restart policy
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: ['production-server'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/vizora.git',
      path: '/var/www/vizora',
      'pre-deploy-local': '',
      'post-deploy': 'pnpm install && pnpm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
    staging: {
      user: 'deploy',
      host: ['staging-server'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/vizora.git', // TODO: Replace with actual repo URL
      path: '/var/www/vizora-staging',
      'post-deploy': 'pnpm install && pnpm run build && pm2 reload ecosystem.config.js --env staging',
    },
  },
};
