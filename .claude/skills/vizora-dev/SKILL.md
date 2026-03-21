---
name: vizora-dev
description: Development skill for Vizora digital signage platform. Use when working on any Vizora feature, bug, component, API, template, or deployment task. Triggers on vizora, signage, template, display, screen, playlist, device, OptiSigns, Indian cuisine, content, schedule, dashboard, realtime, WebSocket, pairing, middleware, or any Vizora-specific component names.
---

# Vizora -- Development Context

## Architecture Overview

Vizora is an Nx monorepo (pnpm workspaces) with three TypeScript services, a shared database package, and Docker infrastructure. The middleware API (NestJS 11, port 3000) handles all business logic, auth, and REST endpoints. The web dashboard (Next.js 16 with App Router, port 3001) provides the admin UI. The realtime gateway (NestJS + Socket.IO, port 3002) manages WebSocket connections for live device status and content push. All three share a Prisma-based PostgreSQL database via the `@vizora/database` workspace package.

## Tech Stack

### Backend (Middleware)
- NestJS 11 with Express
- TypeScript 5.9
- Prisma ORM (PostgreSQL 16)
- Redis 7 (ioredis) -- caching, device status, pairing codes
- MongoDB 7 (Mongoose) -- analytics time-series
- MinIO (S3-compatible) -- file storage via `minio` SDK
- BullMQ -- job queues
- Passport + JWT -- dual auth (user + device)
- Handlebars -- server-side template rendering
- Sharp -- image processing/thumbnails
- Swagger (NestJS Swagger 11) -- API docs at `/api/v1/docs`
- Stripe + Razorpay -- dual payment providers
- Sentry -- error tracking
- prom-client -- Prometheus metrics
- Helmet, CSRF, rate limiting (3-tier)

### Frontend (Web Dashboard)
- Next.js 16 (App Router, React 19)
- TypeScript 5
- Tailwind CSS 3.4
- Zustand -- state management
- TanStack Query v5 -- server state
- TanStack Table v8 -- data tables
- Recharts -- analytics charts
- Framer Motion -- animations
- Lucide React -- icons
- React Hook Form + Zod -- form validation
- CodeMirror 6 -- template HTML editor
- dnd-kit -- drag-and-drop (playlist builder)
- Socket.IO Client -- realtime events
- react-big-calendar -- schedule calendar
- react-dropzone -- file uploads
- Handlebars (client-side) -- template preview

### Realtime Gateway
- NestJS 11 + Socket.IO 4.8
- Same Prisma + Redis stack as middleware
- Device room architecture: `device:{id}` and `org:{orgId}`

### Infrastructure (Docker Compose)
- PostgreSQL 16, Redis 7, MongoDB 7
- MinIO (S3 storage, ports 9000/9001)
- ClickHouse 24 (analytics warehouse)
- Grafana + Prometheus + Loki + Promtail (observability)
- Nginx (production only, gated behind `profiles: ["production"]`)

### Build/Dev Tooling
- Nx 22.4 -- monorepo orchestration
- pnpm 10.28 -- package manager
- SWC -- fast TypeScript compilation
- Webpack -- middleware bundling
- Jest 29 -- unit + E2E tests
- Playwright 1.58 -- browser E2E tests
- Prettier 3.6, ESLint 9

## Folder Structure

```
vizora/
  middleware/                # NestJS API (port 3000)
    src/
      main.ts               # Entry point, bootstrap, port validation
      modules/
        auth/               # JWT strategies, guards, login/register
        content/            # Upload, CRUD, template rendering, data sources
        displays/           # Device management, pairing, status
        playlists/          # Playlist CRUD, ordering
        schedules/          # Schedule CRUD, calendar
        template-library/   # Seed templates, template CRUD, search
        organizations/      # Org management
        users/              # User CRUD, roles
        billing/            # Stripe/Razorpay, plans, subscriptions
        analytics/          # Time-series, impressions
        health/             # Healthcheck, ops-status endpoint
        admin/              # Admin panel APIs
        api-keys/           # API key management
        display-groups/     # Device grouping
        folders/            # Content folder hierarchy
        notifications/      # In-app notifications
        support/            # Support ticket system
        metrics/            # Prometheus metrics
        mail/               # Email service (Nodemailer)
        redis/              # Redis module
        database/           # Database module
        config/             # ConfigModule setup
        storage/            # MinIO/S3 file storage
        common/             # Shared: guards, interceptors, middleware
          interceptors/     # ResponseEnvelope, Sanitize, Logging
          guards/           # CSRF guard
          middleware/        # CSRF middleware
    test/                   # E2E test specs (*.e2e-spec.ts)

  web/                      # Next.js Dashboard (port 3001)
    src/
      app/
        (auth)/             # Login, register, forgot-password routes
        dashboard/
          page.tsx          # Main dashboard
          content/          # Content library, upload, folders
          devices/          # Device list, pairing, status
          templates/        # Template library, create, edit
          playlists/        # Playlist builder
          schedules/        # Schedule calendar
          analytics/        # Charts, reports
          settings/         # Org settings, profile
          health/           # System health monitor
          ops/              # Ops dashboard (admin)
          layouts/          # Layout editor
          widgets/          # Widget components
      components/
        template-editor/    # Visual WYSIWYG editor (iframe + postMessage)
        templates/          # Template cards, sidebar, hero search
        landing/            # Marketing landing page sections
        ui/                 # Shared UI: Card, Badge, Tabs, DataTable, etc.
        auth/               # Auth forms
        charts/             # Chart components
        content/            # Content-specific components
        playlist/           # Playlist components
        providers/          # React context providers
        support/            # Support widget
      lib/
        api.ts              # API client (fetch wrapper)
        hooks/              # useSocket, useAuth, useRealtimeEvents, etc.
        context/            # React contexts
        types.ts            # Shared TypeScript types
      theme/                # Design tokens, colors, icons, chart config

  realtime/                 # WebSocket Gateway (port 3002)
    src/
      gateways/            # device.gateway.ts -- main WS handler
      guards/              # JWT auth for WS connections
      services/            # Device status, content push
      adapters/            # Socket.IO adapter

  packages/
    database/              # Shared Prisma package (@vizora/database)
      prisma/
        schema.prisma      # 28 models, PostgreSQL
        migrations/        # 15+ migrations

  templates/               # HTML template files + seed scripts
    seed/
      indian/              # 12 Indian cuisine templates (HTML files)
      restaurant/          # Restaurant templates
      retail/              # Retail templates
      corporate/           # Corporate templates
      education/           # Education templates
      healthcare/          # Healthcare templates
      events/              # Events templates
      general/             # General templates
      seed-all-templates.ts  # Master seed orchestrator
      generate-thumbnails.ts # Puppeteer thumbnail generator

  display/                 # Electron desktop client
  e2e-tests/               # 24 Playwright spec files
  scripts/ops/             # 6 autonomous ops agents (PM2 cron)
  docker/                  # Docker Compose + Grafana dashboards
  docs/plans/              # Architecture decision docs
  Enhancements/            # Feature planning HTML docs
```

## Active Features

### Fully Built
- User auth (register, login, JWT, password reset, roles: admin/manager/viewer)
- Device pairing (QR code flow, device JWT, Redis-stored pairing codes)
- Content management (upload, CRUD, folders, tagging, thumbnails via Sharp)
- Template library (75+ seeded templates, 8 categories, Handlebars rendering)
- Visual template editor (iframe-based WYSIWYG with floating toolbar)
- Playlist builder (drag-and-drop ordering, duration, content assignment)
- Schedule system (calendar view, time slots, display/group assignment)
- Analytics dashboard (content impressions, device uptime, charts)
- Real-time device status (WebSocket, dual Redis+PostgreSQL persistence)
- Billing (Stripe + Razorpay, 4-tier plans, trial system)
- Admin panel (user management, system config, announcements)
- API key management (scoped keys for programmatic access)
- Ops dashboard (autonomous agent status, health monitoring)
- Landing page (marketing site with 16 sections)
- Support ticket system
- Notification system (in-app bell)
- Command palette (keyboard-driven navigation)
- Device groups (group-based content targeting)
- Content folders (hierarchical organization)
- Dark/light theme

### Autonomous Operations (PM2 Cron)
- health-guardian (every 5min) -- service health, auto-restart
- content-lifecycle (every 15min) -- archive expired content
- fleet-manager (every 10min) -- offline device detection
- schedule-doctor (every 15min) -- deactivate broken schedules
- ops-reporter (every 30min) -- aggregate status, alerts
- db-maintainer (daily 3am) -- vacuum, cleanup

## Known Issues / In Progress

- Template editor: functional but the visual WYSIWYG editor (iframe + postMessage architecture) has limited element support -- only text, images, and containers. No drag-to-reposition, no layer management, no responsive preview breakpoints. The editor loads template HTML into an iframe with editor-runtime.js injected. Element selection and property editing work, but the editor is not competitive with dedicated editors like OptiSigns.
- "Indian" is not a standard category in the middleware DTO validation (categories are: retail, restaurant, corporate, education, healthcare, events, general). The 12 Indian cuisine templates exist in `templates/seed/indian/` and are seeded with `category: 'indian'` but this category may not pass backend validation without DTO update.
- Search + category filter conflict in template library produces 0 results (reported in E2E test report)
- Web build requires `NODE_OPTIONS="--max-old-space-size=4096"` on machines with limited RAM
- 3 admin test suites fail (RSC migration deferral -- async Client Components in jsdom)
- Billing TODO in `plans.ts`: Stripe price objects need to be created when changing plan prices
- vizora-tv (Android TV) specs use Jest syntax but project uses Vitest without `globals: true`

## External Integrations

- **Auth**: Custom JWT (bcryptjs hashing, dual secrets for users vs devices)
- **Storage**: MinIO (S3-compatible, self-hosted). Bucket: `vizora-assets`
- **Payments**: Stripe (international) + Razorpay (India). Org has `paymentProvider` field
- **Email**: Nodemailer (SMTP config via env vars)
- **Error Tracking**: Sentry (optional, via `@sentry/nestjs`)
- **Monitoring**: Prometheus + Grafana + Loki (Docker stack)
- **Alerting**: Slack webhook + email (ops agents)
- **Analytics Storage**: MongoDB (time-series), ClickHouse (warehouse)

## Coding Conventions

### Backend (NestJS)
- Module-per-feature in `middleware/src/modules/`
- DTOs with class-validator decorators for input validation
- Response envelope: `{ success, data, meta }` via `ResponseEnvelopeInterceptor` (skip with `@SkipEnvelope()`)
- API versioning: all routes under `/api/v1`
- Guards: `JwtAuthGuard`, `RolesGuard`, `CsrfGuard`
- Interceptors run in order: LoggingInterceptor then SanitizeInterceptor
- SanitizeInterceptor skips template fields (`templateHtml`, `htmlContent`, `customCss`)
- DataSourceRegistry pattern instead of N individual injections
- PascalCase table names in PostgreSQL (via Prisma `@@map`)
- Tests: Jest with mocked Prisma, `@nestjs/testing` for module setup

### Frontend (Next.js)
- App Router with `(auth)/` route group and `dashboard/` layout
- Client components marked with `'use client'`
- API client in `web/src/lib/api.ts` (fetch-based, cookie auth)
- Custom hooks in `web/src/lib/hooks/` (useSocket, useAuth, useRealtimeEvents)
- Theme tokens in `web/src/theme/` (CSS variables, not Tailwind theme)
- Color scheme: brand green `#00E5A0`, dark background `#061A21`
- Sora font for headings, Inter implied for body
- UI components in `web/src/components/ui/` (custom, not shadcn/ui)
- Loading states: `LoadingSpinner` component
- Error handling: `ErrorBoundary` component, error.tsx per route

### File Naming
- kebab-case for directories
- PascalCase for React components
- camelCase for hooks, utilities, services
- `.spec.ts` / `.e2e-spec.ts` for tests

## Environment Variables

See `.env.example` for full list. Key variables:

```
NODE_ENV, PORT, MIDDLEWARE_PORT, WEB_PORT, REALTIME_PORT
DATABASE_URL, POSTGRES_URL
MONGODB_URL
REDIS_URL, REDIS_PASSWORD
MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_USE_SSL
JWT_SECRET, JWT_EXPIRES_IN, DEVICE_JWT_SECRET
NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL, BACKEND_URL
INTERNAL_API_SECRET
CORS_ORIGIN
LOG_LEVEL
SENTRY_DSN, SENTRY_RELEASE
GRAFANA_ADMIN_USER, GRAFANA_ADMIN_PASSWORD
BACKUP_DIR, BACKUP_RETENTION_DAYS, BACKUP_S3_BUCKET
VALIDATOR_EMAIL, VALIDATOR_PASSWORD, VALIDATOR_BASE_URL
SLACK_WEBHOOK_URL
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
OPS_ALERT_EMAIL
API_BASE_URL, WEB_URL, REALTIME_URL
BCRYPT_ROUNDS
```

## Build and Deploy

### Local Development
```bash
pnpm install
docker-compose -f docker/docker-compose.yml up -d
pnpm --filter @vizora/database db:generate
pnpm --filter @vizora/database db:migrate
pnpm dev  # runs all 3 services via Nx
```

### Individual Services
```bash
npx nx serve @vizora/middleware    # port 3000
npx nx dev @vizora/web             # port 3001
npx nx serve @vizora/realtime      # port 3002
```

### Testing
```bash
pnpm --filter @vizora/middleware test             # 1734 unit tests
pnpm --filter @vizora/middleware test:e2e:full     # E2E with test DB
pnpm --filter @vizora/web test                    # 791 tests
npx playwright test                               # 24 browser E2E specs
```

### Production Build
```bash
npx nx build @vizora/middleware
npx nx build @vizora/web
npx nx build @vizora/realtime
```

### Deployment
- PM2 via `ecosystem.config.js`
- Middleware: 2 instances (cluster mode), Realtime: 1 instance, Web: 1 instance
- Server: vizora.cloud (89.167.55.176), deploy user, PM2 managed
- Deploy: `git pull` then `pnpm install` then build then `pm2 reload`

## When Starting Any Session

1. Check `tasks/lessons.md` for accumulated patterns and pitfalls
2. Review current branch: `git branch --show-current` and `git status`
3. If modifying backend: understand the module structure in `middleware/src/modules/`
4. If modifying frontend: check theme tokens in `web/src/theme/` for color consistency
5. If touching templates: note 8 categories (retail, restaurant, corporate, education, healthcare, events, general, indian) and the seed system in `templates/seed/`
6. If touching auth: remember dual JWT system (user vs device secrets)
7. If touching WebSocket: device rooms are `device:{id}`, org rooms are `org:{orgId}`
8. Never change port assignments (3000, 3001, 3002) -- services validate and exit on mismatch
9. Run tests after changes: middleware has 1734 tests, web has 791

## Reference Files

- [Architecture Details](references/architecture.md)
- [Template System](references/template-system.md)
- [Decisions Log](references/decisions-log.md)
- [Component Map](references/component-map.md)
- [Competitive Positioning](references/competitive-positioning.md)
