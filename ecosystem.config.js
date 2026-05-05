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
      name: 'ops-watchdog',
      script: 'npx',
      args: 'tsx scripts/ops/ops-watchdog.ts',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/15 * * * *', // Run every 15 minutes
      autorestart: false, // Don't restart on exit — cron handles scheduling
      watch: false,
      max_memory_restart: '128M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/ops-watchdog-error.log',
      out_file: './logs/ops-watchdog-out.log',
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
      // R4-HIGH3: LIFECYCLE_LIVE intentionally omitted from env_production.
      // To arm live sends, set LIFECYCLE_LIVE=true in the host OS environment
      // (e.g. /etc/systemd/system/pm2-deploy.service). Pinning it here would
      // override operator intent on every `pm2 reload --env production`.
      env_production: {
        NODE_ENV: 'production',
        VALIDATOR_BASE_URL: 'http://localhost:3000',
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
    // -------- Hermes-driven shadow agents --------
    // PM2 fires the runner script which invokes `hermes -z` with an explicit
    // action prompt. We previously used `hermes cron` directly but the model
    // produced different (worse) behavior in cron-firing context vs `-z`
    // invocation: probe loops on get_prompt/read_resource and chat-text
    // outputs instead of MCP tool calls. The runner+`-z` path
    // demonstrably works end-to-end (audit log + JSONL both populate).
    //
    // The corresponding `hermes cron` jobs MUST be removed at deploy time
    // to prevent duplicate firings:
    //   ssh root@vizora.cloud 'hermes cron list | grep -B1 vizora-* | head'
    //   hermes cron remove <id-customer-lifecycle>
    //   hermes cron remove <id-support-triage>
    {
      name: 'hermes-vizora-customer-lifecycle',
      script: 'bash',
      args: [
        '/opt/vizora/app/scripts/agents/hermes/run-hermes-skill.sh',
        'vizora-customer-lifecycle',
        // The exact prompt that worked end-to-end via `hermes -z`. Keeping
        // it here (vs in the SKILL) is intentional — the SKILL is the
        // SYSTEM-prompt-equivalent, this is the USER-prompt-equivalent
        // that actually triggers execution. Leaving it null produces
        // "discuss the task" behavior in cron context.
        'Run the vizora-customer-lifecycle skill end-to-end now. Follow every step in SKILL.md exactly. Step 1: invoke list_onboarding_candidates on the vizora-platform MCP server. Step 2: for each candidate, invoke log_shadow_row on the vizora-platform server with the per-org decision (or one heartbeat invocation if zero candidates). End silently — no chat output.',
      ],
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/30 * * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/hermes-vizora-customer-lifecycle-error.log',
      out_file: './logs/hermes-vizora-customer-lifecycle-out.log',
      merge_logs: true,
    },
    {
      name: 'hermes-vizora-support-triage',
      script: 'bash',
      args: [
        '/opt/vizora/app/scripts/agents/hermes/run-hermes-skill.sh',
        'vizora-support-triage',
        'Run the vizora-support-triage skill end-to-end now. Follow every step in SKILL.md exactly. Step 1: invoke list_open_support_requests on the vizora MCP server. Step 4: for each ticket, invoke log_shadow_row on the vizora server with the per-ticket score (or one heartbeat invocation if zero tickets). End silently — no chat output.',
      ],
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '*/5 * * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_size: '10M',
      error_file: './logs/hermes-vizora-support-triage-error.log',
      out_file: './logs/hermes-vizora-support-triage-out.log',
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
