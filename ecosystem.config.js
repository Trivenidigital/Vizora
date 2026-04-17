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
      // Wait for app to signal readiness before accepting traffic
      wait_ready: true,
      listen_timeout: 30000,
      // Graceful shutdown — 30s for in-flight requests to complete
      kill_timeout: 30000,
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
      // Wait for app to signal readiness before accepting traffic
      wait_ready: true,
      listen_timeout: 30000,
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
        // NEXT_PUBLIC_* vars must be available at SSR runtime (not just
        // build time). The client ID is public (embedded in the browser
        // anyway), so it's safe to reference here. Load from root .env
        // or web/.env.local at PM2 startup time.
        ...(() => {
          try {
            const fs = require('fs');
            const envPath = require('path').resolve(__dirname, 'web', '.env.local');
            const envContent = fs.readFileSync(envPath, 'utf-8');
            const match = envContent.match(/NEXT_PUBLIC_GOOGLE_CLIENT_ID=(.+)/);
            return match ? { NEXT_PUBLIC_GOOGLE_CLIENT_ID: match[1].trim() } : {};
          } catch { return {}; }
        })(),
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
    {
      name: 'vizora-validator',
      script: 'npx',
      args: 'tsx scripts/validate-monitor.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/15 * * * *', // Run every 15 minutes
      autorestart: false, // Don't restart on exit — cron handles scheduling
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/validator-error.log',
      out_file: './logs/validator-out.log',
      merge_logs: true,
    },
    {
      name: 'ops-health-guardian',
      script: 'npx',
      args: 'tsx scripts/ops/health-guardian.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/5 * * * *', // Run every 5 minutes
      autorestart: false, // Don't restart on exit — cron handles scheduling
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/ops-health-guardian-error.log',
      out_file: './logs/ops-health-guardian-out.log',
      merge_logs: true,
    },
    {
      name: 'ops-content-lifecycle',
      script: 'npx',
      args: 'tsx scripts/ops/content-lifecycle.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/15 * * * *', // Run every 15 minutes
      autorestart: false, // Don't restart on exit — cron handles scheduling
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/ops-content-lifecycle-error.log',
      out_file: './logs/ops-content-lifecycle-out.log',
      merge_logs: true,
    },
    {
      name: 'ops-fleet-manager',
      script: 'npx',
      args: 'tsx scripts/ops/fleet-manager.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/10 * * * *', // Run every 10 minutes
      autorestart: false, // Don't restart on exit — cron handles scheduling
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/ops-fleet-manager-error.log',
      out_file: './logs/ops-fleet-manager-out.log',
      merge_logs: true,
    },
    {
      name: 'ops-schedule-doctor',
      script: 'npx',
      args: 'tsx scripts/ops/schedule-doctor.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/15 * * * *', // Run every 15 minutes
      autorestart: false, // Don't restart on exit — cron handles scheduling
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/ops-schedule-doctor-error.log',
      out_file: './logs/ops-schedule-doctor-out.log',
      merge_logs: true,
    },
    {
      name: 'ops-reporter',
      script: 'npx',
      args: 'tsx scripts/ops/ops-reporter.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/30 * * * *', // Run every 30 minutes
      autorestart: false, // Don't restart on exit — cron handles scheduling
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/ops-reporter-error.log',
      out_file: './logs/ops-reporter-out.log',
      merge_logs: true,
    },
    {
      name: 'ops-db-maintainer',
      script: 'npx',
      args: 'tsx scripts/ops/db-maintainer.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 3 * * *', // Run daily at 3 AM
      autorestart: false, // Don't restart on exit — cron handles scheduling
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/ops-db-maintainer-error.log',
      out_file: './logs/ops-db-maintainer-out.log',
      merge_logs: true,
    },
    // -------- Customer-facing agents (D-agents) --------
    // Dry-run by default. Flip LIFECYCLE_LIVE=true to actually send nudges.
    {
      name: 'agent-customer-lifecycle',
      script: 'npx',
      args: 'tsx scripts/agents/customer-lifecycle.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/30 * * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
        LIFECYCLE_LIVE: 'false',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
        LIFECYCLE_LIVE: 'false',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/agent-customer-lifecycle-error.log',
      out_file: './logs/agent-customer-lifecycle-out.log',
      merge_logs: true,
    },
    {
      name: 'agent-support-triage',
      script: 'npx',
      args: 'tsx scripts/agents/support-triage.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/5 * * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/agent-support-triage-error.log',
      out_file: './logs/agent-support-triage-out.log',
      merge_logs: true,
    },
    // Scaffold agents below — gated OFF by default. Flip the corresponding
    // *_ENABLED env var to true to activate once implementation lands.
    {
      name: 'agent-screen-health-customer',
      script: 'npx',
      args: 'tsx scripts/agents/screen-health-customer.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/10 * * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
        SCREEN_HEALTH_CUSTOMER_ENABLED: 'false',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
        SCREEN_HEALTH_CUSTOMER_ENABLED: 'false',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/agent-screen-health-customer-error.log',
      out_file: './logs/agent-screen-health-customer-out.log',
      merge_logs: true,
    },
    {
      name: 'agent-billing-revenue',
      script: 'npx',
      args: 'tsx scripts/agents/billing-revenue.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/15 * * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
        BILLING_REVENUE_ENABLED: 'false',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
        BILLING_REVENUE_ENABLED: 'false',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/agent-billing-revenue-error.log',
      out_file: './logs/agent-billing-revenue-out.log',
      merge_logs: true,
    },
    {
      name: 'agent-content-intelligence',
      script: 'npx',
      args: 'tsx scripts/agents/content-intelligence.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 * * * *', // hourly
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
        CONTENT_INTELLIGENCE_ENABLED: 'false',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
        CONTENT_INTELLIGENCE_ENABLED: 'false',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/agent-content-intelligence-error.log',
      out_file: './logs/agent-content-intelligence-out.log',
      merge_logs: true,
    },
    {
      name: 'agent-orchestrator',
      script: 'npx',
      args: 'tsx scripts/agents/agent-orchestrator.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/30 * * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
        AGENT_ORCHESTRATOR_ENABLED: 'false',
      },
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
        AGENT_ORCHESTRATOR_ENABLED: 'false',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/agent-orchestrator-error.log',
      out_file: './logs/agent-orchestrator-out.log',
      merge_logs: true,
    },
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: process.env.DEPLOY_USER || 'deploy',
      host: [process.env.PRODUCTION_HOST || 'production-server'],
      ref: process.env.PRODUCTION_REF || 'origin/main',
      repo: process.env.GIT_REPO_URL || 'git@github.com:your-org/vizora.git',
      path: process.env.PRODUCTION_PATH || '/var/www/vizora',
      'pre-deploy-local': '',
      'post-deploy': 'pnpm install && pnpm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
    staging: {
      user: process.env.DEPLOY_USER || 'deploy',
      host: [process.env.STAGING_HOST || 'staging-server'],
      ref: process.env.STAGING_REF || 'origin/develop',
      repo: process.env.GIT_REPO_URL || 'git@github.com:your-org/vizora.git',
      path: process.env.STAGING_PATH || '/var/www/vizora-staging',
      'post-deploy': 'pnpm install && pnpm run build && pm2 reload ecosystem.config.js --env staging',
    },
  },
};
