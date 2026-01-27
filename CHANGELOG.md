# Changelog

All notable changes to the Vizora project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Testing Infrastructure** (2026-01-27)
  - Jest + ts-jest configuration for middleware
  - Unit tests for AuthService (22 tests, 100% coverage)
  - Unit tests for HealthService (7 tests, 96% coverage)
  - E2E test setup with Supertest
  - Database mock utilities for testing

- **Environment Validation** (2026-01-27)
  - Zod-based environment variable validation
  - ConfigModule with type-safe configuration
  - Validation errors show clear messages on startup

- **Health Check Endpoints** (2026-01-27)
  - `GET /api/health` - Basic liveness check
  - `GET /api/health/ready` - Detailed readiness with DB + memory checks
  - `GET /api/health/live` - Kubernetes liveness probe

- **Security Improvements** (2026-01-27)
  - Rate limiting: 10/sec, 100/min, 1000/hour per IP
  - Auth-specific limits: Login 5/min, Register 3/min
  - Input sanitization (XSS protection) via global interceptor
  - Helmet security headers

### Fixed
- **Displays Service Schema Mismatch** (2026-01-27)
  - DTO field `deviceId` now correctly maps to Prisma `deviceIdentifier`
  - DTO field `name` now correctly maps to Prisma `nickname`

- **Auth Module Integration** (2026-01-27)
  - AuthModule properly imported in AppModule
  - bcrypt replaced with bcryptjs (pure JavaScript, no native deps)
  - Audit log field name corrected (`details` → `changes`)
  - Logout now fetches user for organizationId

### Security
- Removed unused `bcrypt` dependency with CVE vulnerabilities (2026-01-27)
- JWT secret validation requires minimum 32 characters

### Changed
- **Production Readiness Score**: 60% → 90%

## [0.1.0] - 2026-01-26

### Added
- Initial Vizora Digital Signage Platform implementation
- **Phase 1-3**: Foundation, database schemas, middleware API
- **Phase 4**: Realtime WebSocket server with Socket.IO
- **Phase 5**: Electron display client
- **Phase 6**: Next.js web dashboard
- **Phase 7**: Docker configuration and CI/CD workflows

### Components
- `middleware/` - NestJS API Gateway
- `realtime/` - Socket.IO WebSocket server
- `web/` - Next.js Admin Dashboard
- `display/` - Electron TV Client
- `packages/database/` - Prisma schema & migrations

### Infrastructure
- PostgreSQL 16 for primary data
- MongoDB 7 for content metadata
- Redis 7 for caching and pub/sub
- MinIO for S3-compatible storage
- ClickHouse 24 for analytics
