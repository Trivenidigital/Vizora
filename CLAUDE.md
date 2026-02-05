# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vizora is a digital signage management platform. Businesses manage and distribute content to display screens across locations via an admin dashboard, with real-time updates over WebSocket.

## Architecture

Nx monorepo with pnpm workspaces. Five services with strict port assignments:

| Service | Tech | Port | Package |
|---------|------|------|---------|
| Middleware API | NestJS 11 | 3000 | `@vizora/middleware` |
| Web Dashboard | Next.js 16 (App Router) | 3001 | `@vizora/web` |
| Realtime Gateway | NestJS + Socket.IO | 3002 | `@vizora/realtime` |
| Grafana | - | 3003 | Docker only |
| MinIO (S3 storage) | - | 9000/9001 | Docker only |

**Ports are hardcoded and enforced** — both middleware and realtime validate their port at startup and exit if misconfigured.

Shared packages:
- `@vizora/database` — Prisma ORM client (PostgreSQL), used by middleware and realtime

Infrastructure (via `docker/docker-compose.yml`): PostgreSQL 16, Redis 7, MongoDB 7, MinIO, ClickHouse 24, Grafana

## Development Commands

```bash
# Setup
pnpm install
docker-compose -f docker/docker-compose.yml up -d
pnpm --filter @vizora/database db:generate    # Generate Prisma client
pnpm --filter @vizora/database db:migrate     # Run migrations

# Run all services
pnpm dev

# Individual services via Nx
npx nx serve @vizora/middleware
npx nx dev @vizora/web
npx nx serve @vizora/realtime

# Build
npx nx build @vizora/middleware
npx nx build @vizora/web
npx nx build @vizora/realtime
```

## Testing

```bash
# Middleware unit tests (Jest, mocked DB)
pnpm --filter @vizora/middleware test
pnpm --filter @vizora/middleware test -- --testPathPattern=content.service  # single file

# Middleware E2E tests (Jest, real DB via docker-compose.test.yml)
pnpm --filter @vizora/middleware test:e2e
pnpm --filter @vizora/middleware test:e2e:full  # starts test DB, runs tests, stops DB

# Web unit tests (Jest + jsdom + React Testing Library)
pnpm --filter @vizora/web test

# Playwright E2E tests (requires all services running)
npx playwright test                          # all 15 spec files
npx playwright test e2e-tests/01-auth.spec.ts  # single spec
npx playwright test --headed                 # with browser UI
```

Playwright runs sequentially (1 worker) to avoid DB race conditions. Retries: 2 in CI, 0 locally.

## Key Architectural Patterns

**Dual JWT authentication**: Separate secrets for users (`JWT_SECRET`) and display devices (`DEVICE_JWT_SECRET`). Devices authenticate via device-specific JWT in WebSocket handshake.

**WebSocket room architecture**: Realtime gateway uses `device:{deviceId}` and `org:{organizationId}` rooms. Devices join both on connect. Dashboard clients join org rooms for live status updates.

**Dual persistence for device status**: Device online/offline status writes to both Redis (fast reads) and PostgreSQL (persistence/dashboard queries).

**Content system**: Supports image/video/url/html types. Template rendering via Handlebars. File validation with magic number verification to prevent MIME spoofing. Expiration system with automatic replacement content.

**Security layers**: Global SanitizeInterceptor on all responses (XSS), CSRF middleware, Helmet headers, rate limiting (3-tier: short/medium/long, 100x relaxed in dev/test), cookie-based auth with httpOnly cookies.

**Interceptor order matters**: LoggingInterceptor runs before SanitizeInterceptor so raw input is logged for debugging.

## Environment Variables

```
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET            # User auth JWT secret (min 32 chars)
DEVICE_JWT_SECRET     # Device auth JWT secret (min 32 chars)
REDIS_URL             # Redis connection URL
NEXT_PUBLIC_API_URL   # Backend API URL for web frontend
NEXT_PUBLIC_SOCKET_URL # Realtime gateway URL for web frontend
```

## Project Structure Highlights

```
middleware/src/modules/    # NestJS modules: auth, content, displays, playlists, schedules, organizations, health, users, redis, database, config, common
middleware/src/modules/common/  # Shared guards (csrf), interceptors (logging, sanitize), middleware (csrf)
middleware/test/           # E2E test specs (*.e2e-spec.ts)
packages/database/prisma/schema.prisma  # Data model: Organization, User, Display, Content, Playlist, Schedule, DisplayGroup, Tag
web/src/app/               # Next.js App Router: (auth)/, dashboard/, api/
web/src/lib/hooks/          # useSocket, useRealtimeEvents for WebSocket integration
realtime/src/gateways/     # device.gateway.ts — main WebSocket handler
e2e-tests/                 # 15 Playwright spec files (01-auth through 15-comprehensive-integration)
```

## Display Clients

**Electron** (`display/`): Desktop app for Windows/macOS/Linux. Webpack + TypeScript. Packages via electron-builder.

**Android TV** (`display-android/`): Capacitor 6 + Vite. Requires Android Studio + JDK 17 + SDK 34. Supports leanback launcher, D-pad nav, auto-start on boot.

## Production Deployment

PM2 via `ecosystem.config.js`: middleware runs 2 instances in cluster mode, realtime runs single instance (WebSocket state consistency), web runs single instance. All have memory limits, exponential backoff restart, and graceful shutdown.

## Swagger Docs

Available at `http://localhost:3000/api/docs` in development mode only.
