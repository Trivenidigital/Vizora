# Vizora Production Readiness Report

**Date:** 2026-03-07
**Auditor:** Claude Opus 4.6 (Automated Deep Code Review)
**Codebase Version:** commit `10a44dc` (main branch)
**Methodology:** 6 parallel audit agents + direct code review across all services

---

## Executive Summary

**Overall Production Readiness Score: 72/100**

The Vizora codebase demonstrates **strong security fundamentals** -- authentication, multi-tenancy isolation, and input validation are well-implemented. However, the expanded audit uncovered additional critical and high-severity issues beyond the initial review, particularly around fail-open auth patterns, insecure randomness, cross-org data leakage in cron jobs, and operational gaps.

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 6 | Must fix before any production traffic |
| **HIGH** | 14 | Should fix before launch |
| **MEDIUM** | 14 | Fix within first month |
| **LOW** | 12 | Tech debt, fix over time |

---

## Architecture Diagram

```
                    +------------------+
                    |   Nginx (TLS)    |  Port 80/443
                    |  (production)    |
                    +--------+---------+
               +-------------+-------------+
               v             v             v
        +----------+  +----------+  +----------+
        |Middleware |  |   Web    |  | Realtime |
        | NestJS   |  | Next.js  |  | NestJS   |
        | :3000    |  | :3001    |  | :3002    |
        | (x2 PM2) |  | (x1)    |  | (x1)    |
        +----+-----+  +----------+  +----+-----+
             |                            |
             |    +---------+             |
             +--->| Redis   |<------------+  Session/Cache/
             |    | :6379   |             |  Device Status
             |    +---------+             |
             |    +---------+             |
             +--->|PostgreSQL|<-----------+  Primary DB
             |    | :5432   |             |
             |    +---------+             |
             |    +---------+
             +--->| MinIO   |  File Storage (S3-compatible)
             |    | :9000   |
             |    +---------+
             |    +-------------+
             +--->| MongoDB     |  Analytics/Logs (future, unused)
                  | :27017      |
                  +-------------+

        +------------+          +------------+
        | Electron   | <--WS--> |  Android   |
        | Display    |          |  TV App    |
        +------------+          +------------+
```

---

## Metrics

| Metric | Value |
|--------|-------|
| Total source files (.ts/.tsx) | 675 |
| Total lines of source code | 84,580 |
| Database models (Prisma) | 29 |
| API endpoints (middleware) | 239 |
| API endpoints (realtime) | 7 |
| Test files | 174 |
| Known test pass rate | Middleware: 1734/1734, Realtime: 205/205, Web: 791/819 |
| `: any` type usage | 446 (middleware: 125, web: 297, realtime: 24) |
| `console.log` in source | ~61 (middleware: 19, web: 42) |
| TODO/FIXME/HACK comments | ~19 (middleware: 11, web: 8) |
| Files over 500 lines | 21 |
| Dependency vulnerabilities | 39 (1 critical, 28 high, 7 moderate, 3 low) |
| Hardcoded secrets in current code | 0 |
| Hardcoded secrets in git history | 4 (JWT_SECRET, DEVICE_JWT_SECRET, MinIO keys -- rotated) |
| Endpoints without auth | 14 (all intentional: health, auth, pairing, webhooks, device-content) |
| Queries missing org scoping | 1 (checkExpiredContent cron) |
| CI/CD pipeline | Yes (lint, test, e2e, build, security audit) |
| Foreign key constraints | 42 onDelete rules defined |
| RBAC-protected endpoints | 131+ with @Roles() decorator |
| Duplicate Dockerfiles | 7 (3 in docker/, 3 in service roots, 1 nginx) -- different Node versions! |

---

## Issue Inventory

---

### CRITICAL Issues (6)

---

### [C1] Secrets Exposed in Git History
- **Category:** Security > Secrets & Configuration
- **File(s):** `.env` (deleted in commit `fb1bdf6`, previously committed in `a42675b`)
- **Description:** The `.env` file was committed to git with actual secrets including `JWT_SECRET=vizora-dev-secret-key-change-in-production-32chars`, `DEVICE_JWT_SECRET=vizora-device-secret-key-change-in-production`, and MinIO default credentials. Although the file was removed and secrets rotated in commit `fb1bdf6`, the secrets remain in git history permanently.
- **Risk:** Anyone with repo access (current or former contributors, forks) can extract the original secrets from git history. If these secrets were ever used in production before rotation, tokens signed with them could still be valid.
- **Fix:** (1) Verify that production secrets have been fully rotated and are different from the git-exposed values. (2) Consider `git filter-branch` or BFG Repo-Cleaner to purge history (destructive, requires force-push). (3) At minimum, document that git history contains stale secrets.
- **Effort:** Small (verification) / Large (history purge)

---

### [C2] 39 Dependency Vulnerabilities (1 Critical, 28 High)
- **Category:** Security > Dependencies
- **File(s):** `package.json` (root and service-level)
- **Description:** `pnpm audit` reports 39 vulnerabilities:
  - **1 Critical:** `fast-xml-parser` entity encoding bypass (used by `minio` package)
  - **28 High:** Including `multer` DoS (3 separate vulns -- directly used for file uploads), `rollup` path traversal, `node-tar` arbitrary file overwrite, `serialize-javascript` RCE, `axios` prototype pollution DoS, `immutable` prototype pollution, `SVGO` DoS
  - **7 Moderate:** Including `DOMPurify` XSS, `Next.js` DoS, `lodash` prototype pollution
  - **3 Low:** `qs`, `@tootallnate/once`, `fast-xml-parser` stack overflow
- **Risk:** The `multer` vulnerabilities are particularly concerning as multer is directly used for file upload handling. The `fast-xml-parser` critical vuln is in the MinIO client path. These could enable DoS attacks on file upload endpoints or XML-based attacks on MinIO operations.
- **Fix:** (1) `pnpm update` to pull latest patch versions. (2) For transitive deps, check if parent packages have newer versions. (3) For unfixable transitive deps, assess if the vulnerable code path is actually reachable. (4) Prioritize: multer (direct), fast-xml-parser (MinIO), serialize-javascript (RCE risk).
- **Effort:** Medium (2-4 hours)

---

### [C3] `enableImplicitConversion: true` in ValidationPipe
- **Category:** Security > Input Validation
- **File(s):** `middleware/src/main.ts:106`
- **Description:** The global `ValidationPipe` has `enableImplicitConversion: true`, which automatically converts query/body parameters to their declared types. This can bypass validation by coercing unexpected values. For example, a string `"true"` becomes boolean `true`, and `"0"` becomes number `0`, potentially bypassing guards or filters.
- **Risk:** Type coercion can lead to authorization bypass if a guard checks `if (value)` on a field that was implicitly converted. It also weakens the type safety that TypeScript strict mode provides.
- **Fix:** Set `enableImplicitConversion: false` and add explicit `@Type(() => Number)` / `@Transform()` decorators to DTOs that need type conversion. This was identified as a known risk in `tasks/lessons.md` but never fixed.
- **Effort:** Medium (need to audit all DTOs and add explicit transforms)

---

### [C4] Redis-Down Brute Force Bypass (Auth Fails Open)
- **Category:** Security > Authentication
- **File(s):** `middleware/src/modules/auth/auth.service.ts:148-151`
- **Description:** The login method checks account lockout via `this.redisService.get(lockoutKey)`. If Redis is unavailable, `redisService.get()` will throw an exception. The code does NOT have a try/catch around the Redis lockout check -- the exception will bubble up and cause a 500 error (which blocks login). However, the `incrementLoginAttempts` call on line 167/175 also depends on Redis. If Redis fails intermittently (returns null/undefined instead of throwing), the lockout counter resets to 0 on every attempt, effectively disabling brute force protection.
- **Risk:** If Redis becomes intermittently unavailable or returns errors that are caught silently elsewhere, the 10-attempt lockout is bypassed entirely. An attacker who can cause Redis instability (e.g., via connection exhaustion) can brute-force passwords without lockout.
- **Fix:** (1) Wrap Redis lockout check in try/catch with fail-CLOSED behavior (deny login if Redis is unreachable). (2) Add a fallback in-memory rate limiter. (3) Log Redis failures in the auth path as critical alerts.
- **Effort:** Small (1 hour)

---

### [C5] `Math.random()` for Temporary Password Generation
- **Category:** Security > Cryptography
- **File(s):** `middleware/src/modules/users/users.service.ts:211-217`
- **Description:** The `generateTempPassword()` method uses `Math.random()` to generate temporary passwords: `chars.charAt(Math.floor(Math.random() * chars.length))`. `Math.random()` is NOT cryptographically secure -- its output is predictable given enough samples (V8 uses xorshift128+, which can be reversed with ~600 outputs).
- **Risk:** If an attacker can observe timing or other side-channels of password generation, they may predict temporary passwords. Even without side-channels, `Math.random()` provides ~52 bits of state, far below the security margin for password generation.
- **Fix:** Replace with `crypto.randomInt()` or `crypto.randomBytes()`:
  ```typescript
  password += chars.charAt(crypto.randomInt(chars.length));
  ```
  The `crypto` module is already imported in `file-validation.service.ts`.
- **Effort:** Small (10 minutes)

---

### [C6] Cross-Org Data Leakage in `checkExpiredContent()` Cron
- **Category:** Security > Multi-Tenancy
- **File(s):** `middleware/src/modules/content/content.service.ts:328-361`
- **Description:** The `@Cron(CronExpression.EVERY_HOUR)` method `checkExpiredContent()` runs `db.content.findMany({ where: { expiresAt: { lte: now }, status: 'active' } })` **without any `organizationId` filter**. It then processes ALL expired content across ALL organizations, including replacing playlist items. If a `replacementContentId` from one org is set on content belonging to another org (e.g., via a bug or direct DB manipulation), the cron job will cross-pollinate playlist content between organizations.
- **Risk:** The `updateMany` on line 343-346 replaces `playlistItem.contentId` with `content.replacementContentId` without verifying that the replacement content belongs to the same organization. This could result in one organization's displays showing another organization's content.
- **Fix:** (1) Add `organizationId` grouping to the cron query. (2) Validate that `replacementContentId` belongs to the same `organizationId` as the expiring content before substitution. (3) Process each org independently.
- **Effort:** Small (30 minutes)

---

### HIGH Issues (14)

---

### [H1] 7-Day JWT Token Expiry Without Token Revocation List
- **Category:** Security > Authentication
- **File(s):** `middleware/src/modules/auth/constants/auth.constants.ts:12`, `middleware/src/modules/auth/auth.service.ts:142`
- **Description:** JWT tokens expire after 7 days (`TOKEN_EXPIRY_SECONDS: 604800`). There is no server-side token revocation/blacklist. If a token is stolen, it remains valid for up to 7 days even after the user logs out or changes their password.
- **Risk:** Stolen tokens cannot be invalidated. The `jti` field already exists in the JWT payload but is unused.
- **Fix:** (1) Implement a Redis-based token blacklist checked on every request (add JTI on logout, password change, deactivation). (2) Alternatively, reduce token expiry to 1-2 hours with aggressive refresh.
- **Effort:** Medium (2-3 hours)

---

### [H2] LoginDto Missing `@MaxLength` on Password (bcrypt DoS)
- **Category:** Security > Input Validation
- **File(s):** `middleware/src/modules/auth/dto/login.dto.ts:16-17`
- **Description:** The `LoginDto.password` field has only `@IsString()` with no `@MaxLength()` constraint. bcrypt internally truncates at 72 bytes, but the hashing operation itself is CPU-intensive (14 rounds). An attacker can send a 1MB password string; bcrypt will spend significant CPU time hashing it before truncation.
- **Risk:** A determined attacker sending many concurrent login requests with very large passwords can cause CPU exhaustion, effectively DoS-ing the authentication endpoint. Rate limiting partially mitigates this, but the 100x relaxation in dev/test means this is not exercised.
- **Fix:** Add `@MaxLength(128)` (or 72 to match bcrypt's actual limit) to `LoginDto.password`. Also add to `RegisterDto.password`.
- **Effort:** Small (5 minutes)

---

### [H3] 446 `any` Type Usages Across Codebase
- **Category:** Code Quality > TypeScript Safety
- **File(s):** Distributed across 164 files (middleware: 125 in 69 files, web: 297 in 87 files, realtime: 24 in 8 files)
- **Description:** Despite TypeScript `strict: true`, there are 446 instances of `: any` or `as any`. The web frontend is the worst offender (297 instances).
- **Risk:** Type-unsafe code can lead to runtime errors. In security-critical paths, type confusion could enable bypasses.
- **Fix:** Prioritize eliminating `any` in: auth module, billing module, admin module, WebSocket gateway. Use `Prisma.InputJsonValue`, `Record<string, unknown>`, and proper interface types.
- **Effort:** Large (ongoing, ~20-30 hours total)

---

### [H4] 21 Files Over 500 Lines -- Monolithic Components
- **Category:** Code Quality > Architecture
- **File(s):** `web/src/app/page.tsx` (2,077 lines), `web/src/app/dashboard/content/page-client.tsx` (1,798 lines), `web/src/lib/api.ts` (1,555 lines), `middleware/src/modules/content/content.service.ts` (1,257 lines), `realtime/src/gateways/device.gateway.ts` (1,226 lines), `middleware/src/modules/admin/admin.controller.ts` (992 lines), `middleware/src/modules/billing/billing.service.ts` (884 lines)
- **Description:** Multiple files exceed 500 lines, some dramatically. The landing page at 2,077 lines is a single component.
- **Risk:** Maintenance burden, merge conflict risk, cognitive load.
- **Fix:** Split by domain responsibility.
- **Effort:** Large (multiple sprints)

---

### [H5] No UUID Validation on Most Route Parameters
- **Category:** Security > Input Validation
- **File(s):** All controllers with `:id` params
- **Description:** Only 6 instances of `ParseUUIDPipe` or `@IsUUID()` found. Most controller methods accept `:id` as raw strings without UUID validation.
- **Risk:** Wasted DB queries on invalid IDs, verbose error messages from Prisma.
- **Fix:** Add `@Param('id', ParseUUIDPipe) id: string` to all route handlers expecting UUIDs.
- **Effort:** Small (1-2 hours, mechanical)

---

### [H6] WebSocket Cookie Name Mismatch
- **Category:** Reliability > WebSocket
- **File(s):** `realtime/src/gateways/device.gateway.ts:282`, `middleware/src/modules/auth/constants/auth.constants.ts:18`
- **Description:** Auth cookie is `vizora_auth_token` but the WebSocket gateway regex matches `vizora_token` on line 282.
- **Risk:** Dashboard WebSocket connections may fail to authenticate via cookie, falling back to handshake token.
- **Fix:** Change regex to match `vizora_auth_token`.
- **Effort:** Small (5 minutes)

---

### [H7] Password Reset Token Not Single-Use Enforced at DB Level
- **Category:** Security > Authentication
- **File(s):** `packages/database/prisma/schema.prisma:94-106`
- **Description:** The `PasswordResetToken` model has `usedAt` for tracking but no DB-level constraint preventing concurrent reuse (race condition).
- **Risk:** A reset token could be used twice simultaneously before `usedAt` is set.
- **Fix:** Use a Prisma transaction with `updateMany` that includes `usedAt: null` in the where clause (atomic check-and-set).
- **Effort:** Small (30 minutes)

---

### [H8] E2E Tests Use `continue-on-error: true` -- Failures Are Silent
- **Category:** DevOps > CI/CD
- **File(s):** `.github/workflows/ci.yml:92,148,152`
- **Description:** Both realtime unit tests and all E2E test steps use `continue-on-error: true`. Security audit step also. Test failures do not fail the CI pipeline.
- **Risk:** Regressions can be merged without detection.
- **Fix:** Remove `continue-on-error: true` from test steps. Keep only for security audit (informational).
- **Effort:** Small

---

### [H9] No Account Deletion / Data Purge Capability (GDPR)
- **Category:** DevOps > Data Management
- **File(s):** No implementation exists
- **Description:** No endpoint for users to delete their account and all associated data. Schema cascades from Organization, but no API triggers full cleanup (MinIO files, Redis cache, audit logs, support requests).
- **Risk:** GDPR non-compliance ("right to be forgotten").
- **Fix:** Implement `DELETE /api/v1/organizations/:id` with full cleanup.
- **Effort:** Medium (4-6 hours)

---

### [H10] Missing WsExceptionFilter on DeviceGateway
- **Category:** Reliability > WebSocket
- **File(s):** `realtime/src/gateways/device.gateway.ts` (no `@UseFilters` decorator)
- **Description:** The DeviceGateway has no `@UseFilters()` decorator. NestJS WebSocket gateways need their own exception filter -- the global HTTP `AllExceptionsFilter` does NOT cover WebSocket contexts. Unhandled exceptions in message handlers will crash the socket connection or be silently swallowed, with no standardized error response to the client.
- **Risk:** A WsValidationPipe exists (`realtime/src/gateways/pipes/ws-validation.pipe.ts`) and throws `WsException`, but without a filter, these exceptions may not be properly formatted for the client. Unexpected errors could disconnect all sockets on that gateway instance.
- **Fix:** Create a `WsExceptionFilter` implementing `ExceptionFilter` for WebSocket contexts, and apply it with `@UseFilters(WsExceptionFilter)` on the gateway class.
- **Effort:** Small (1-2 hours)

---

### [H11] SupportRequest Missing `onDelete` -- Blocks Organization Deletion
- **Category:** Security > Data Management
- **File(s):** `packages/database/prisma/schema.prisma:745`
- **Description:** The `SupportRequest.organization` relation on line 745 has NO `onDelete` clause: `organization Organization @relation(fields: [organizationId], references: [id])`. Every other model with an `organizationId` uses `onDelete: Cascade`. Without it, deleting an organization will fail with a foreign key constraint violation if any support requests exist.
- **Risk:** Blocks GDPR organization deletion (H9). Also blocks any admin cleanup of abandoned organizations.
- **Fix:** Add `onDelete: Cascade` to the `SupportRequest.organization` relation. Also check `SupportRequest.user` and `SupportRequest.resolvedBy` relations (lines 746-747).
- **Effort:** Small (5 minutes + migration)

---

### [H12] Local Disk Fallback in Production Cluster Mode
- **Category:** Reliability > Storage
- **File(s):** `middleware/src/modules/storage/storage.service.ts:69-73`
- **Description:** When MinIO is unavailable at startup, the storage service logs a warning and falls back to local storage (`this.available = false`). With PM2 cluster mode running 2 middleware instances, local disk storage is split across process instances -- files uploaded to instance 1 are invisible to instance 2.
- **Risk:** Content uploaded during a MinIO outage will only be accessible from the instance that received the upload. Users may see intermittent 404s for their content. On restart, files in `/tmp` or local paths are lost.
- **Fix:** (1) Make MinIO a hard requirement for production (fail startup if unavailable). (2) If graceful degradation is needed, add a shared NFS mount. (3) At minimum, alert when falling back to local storage.
- **Effort:** Small (configuration change)

---

### [H13] `decodeHtmlEntities` Re-introduces XSS Vectors in Output
- **Category:** Security > Output Sanitization
- **File(s):** `middleware/src/modules/common/interceptors/sanitize.interceptor.ts:177-185`
- **Description:** The `SanitizeInterceptor` first sanitizes output (stripping HTML tags, encoding entities), then calls `decodeHtmlEntities()` which converts `&lt;` back to `<`, `&gt;` to `>`, `&quot;` to `"`, etc. This re-introduces the exact characters that sanitization was meant to neutralize. If a value somehow passes through sanitization with encoded entities (e.g., nested encoding), the decode step un-does the protection.
- **Risk:** If any API response is rendered as HTML (e.g., in an email template, PDF generation, or third-party integration), the decoded entities could execute as HTML/JavaScript. For pure JSON API consumers (React), this is lower risk since React auto-escapes, but it weakens defense-in-depth.
- **Fix:** (1) Remove `decodeHtmlEntities` -- JSON consumers don't need decoded HTML entities. (2) If decode is needed for display, only decode `&amp;` (which is safe), not `&lt;`/`&gt;`/`&quot;`. (3) At minimum, remove `&lt;`/`&gt;` decoding.
- **Effort:** Small (30 minutes)

---

### [H14] `Math.random()` Used for Request IDs
- **Category:** Security > Logging
- **File(s):** `middleware/src/modules/common/interceptors/logging.interceptor.ts:114`
- **Description:** Request IDs are generated with `Math.random().toString(36).substr(2, 9)`. While not a direct security vulnerability, predictable request IDs could allow log injection or request correlation attacks.
- **Risk:** Low direct risk, but non-cryptographic randomness in security-relevant identifiers is poor practice. An attacker could predict future request IDs and craft log entries that appear legitimate.
- **Fix:** Use `crypto.randomUUID()` for request IDs. This also provides proper UUID format for distributed tracing.
- **Effort:** Small (5 minutes)

---

### MEDIUM Issues (14)

---

### [M1] Device Status Cache (`Map`) Grows Unboundedly in Realtime Gateway
- **Category:** Performance > Memory Leaks
- **File(s):** `realtime/src/gateways/device.gateway.ts:79-88`
- **Description:** Four `Map` instances for caching. `deviceStatusCache` and `deviceSockets` only clean up on disconnect events. Network failures may skip `handleDisconnect`.
- **Risk:** Memory growth over months with thousands of devices.
- **Fix:** Add periodic cleanup (every 5 min) removing entries not in any active socket room.
- **Effort:** Small (1 hour)

---

### [M2] Frontend `console.log` Statements in Production Hooks
- **Category:** Code Quality > Logging
- **File(s):** `web/src/lib/hooks/useSocket.ts` (3), `web/src/lib/hooks/useRealtimeEvents.ts` (10), `web/src/lib/hooks/useOptimisticState.ts` (5), `web/src/lib/hooks/useErrorRecovery.ts` (6), `web/src/lib/api.ts` (8)
- **Description:** 42 `console.log` statements in web frontend source, visible in production browser consoles.
- **Risk:** Information leakage (org IDs, device info, API responses).
- **Fix:** Replace with dev-guarded logger utility.
- **Effort:** Small (1-2 hours)

---

### [M3] No Database Connection Pooling Configuration
- **Category:** Reliability > Database
- **File(s):** `packages/database/prisma/schema.prisma:10`
- **Description:** With 2 middleware + 1 realtime instances, each gets its own Prisma pool. Could exceed PostgreSQL's default 100 max_connections.
- **Risk:** Connection pool exhaustion under load.
- **Fix:** Configure explicit `connection_limit` per instance. Consider PgBouncer.
- **Effort:** Small

---

### [M4] No Request ID / Correlation ID for Distributed Tracing
- **Category:** DevOps > Logging
- **File(s):** `middleware/src/modules/common/interceptors/logging.interceptor.ts`
- **Description:** No correlation ID passed between middleware, realtime, and device requests. Debugging cross-service issues is difficult.
- **Fix:** Add middleware that generates/uses `X-Request-ID` header, include in all log entries.
- **Effort:** Medium (2-3 hours)

---

### [M5] Rate Limiting in Development/Test is 100x Relaxed
- **Category:** Security > Rate Limiting
- **File(s):** `middleware/src/app/app.module.ts:45-63`
- **Description:** Rate limits are 100x relaxed in dev/test. Production limits never tested.
- **Fix:** Add at least one E2E test with production-like limits.
- **Effort:** Small (1 hour)

---

### [M6] Landing Page is a 2,077-Line Single Component
- **Category:** Code Quality > Architecture
- **File(s):** `web/src/app/page.tsx` (2,077 lines)
- **Description:** Entire landing page in one file: hero, features, pricing, testimonials, footer, animations.
- **Fix:** Extract into separate section components.
- **Effort:** Medium (2-4 hours)

---

### [M7] No Circuit Breaker for External Service Calls
- **Category:** Reliability > Graceful Degradation
- **File(s):** `middleware/src/modules/billing/providers/stripe.provider.ts`, `middleware/src/modules/billing/providers/razorpay.provider.ts`
- **Description:** External calls (Stripe, Razorpay) have no circuit breaker. MinIO storage service does have one (`storage.service.ts:109`), but billing providers don't.
- **Risk:** Cascading failures from degraded external services.
- **Fix:** Implement circuit breaker pattern (e.g., `opossum` library) for billing providers.
- **Effort:** Medium (3-4 hours)

---

### [M8] No Pagination on Some Admin List Endpoints
- **Category:** Performance > API
- **File(s):** `middleware/src/modules/admin/admin.controller.ts`
- **Description:** 63 admin endpoints. Some list endpoints may not enforce pagination.
- **Fix:** Ensure all list endpoints enforce pagination (limit=50, max=200).
- **Effort:** Small (1-2 hours)

---

### [M9] Static Template Assets Served with 30-Day Cache but No Versioning
- **Category:** Performance > Caching
- **File(s):** `middleware/src/main.ts:55-58`
- **Description:** Template seed assets served with `maxAge: '30d'` but no cache-busting mechanism.
- **Fix:** Add content hash to filenames or use ETag headers.
- **Effort:** Small (1 hour)

---

### [M10] Next.js `remotePatterns` Only Allows Localhost
- **Category:** Performance > Frontend
- **File(s):** `web/next.config.js:21-36`
- **Description:** The `images.remotePatterns` config only allows `http://localhost:3000`. In production, the API is at a different host (e.g., `vizora.cloud`), so Next.js `<Image>` component optimization will not work for API-served images.
- **Risk:** In production, images from the API server will either fail to load through `<Image>` or bypass optimization entirely, resulting in unoptimized images and slower page loads.
- **Fix:** Add production API hostname to `remotePatterns` (e.g., via `process.env.NEXT_PUBLIC_API_URL` parsing). Support both localhost (dev) and production URLs.
- **Effort:** Small (15 minutes)

---

### [M11] Duplicate Dockerfiles with Different Node Versions (7 total)
- **Category:** DevOps > Infrastructure
- **File(s):** `docker/Dockerfile.middleware`, `docker/Dockerfile.realtime`, `docker/Dockerfile.web` vs `middleware/Dockerfile`, `realtime/Dockerfile`, `web/Dockerfile` + `docker/nginx/Dockerfile`
- **Description:** Each service has a Dockerfile both in `docker/` and in its own root directory. Critically, they use **different Node versions**: `docker/` uses `node:22-alpine` while service-root versions use `node:20-alpine`. They also differ in: pnpm install method, user isolation (docker/ creates `vizora:vizora` user, root versions use default `node`), healthchecks (docker/ has them, root versions don't), and production dependency filtering.
- **Risk:** Depending on which Dockerfile is used, the resulting image has different Node runtimes, security posture, and configuration. This is a critical source of environment drift.
- **Fix:** Choose one location, remove duplicates. Standardize on Node 22 (matches local dev) with the more complete `docker/` configuration.
- **Effort:** Small (30 minutes)

---

### [M12] Loki Has No Volume Mount -- Logs Lost on Container Restart
- **Category:** DevOps > Infrastructure
- **File(s):** `docker/docker-compose.yml:245-257`
- **Description:** The Loki container has no volume mount for its data directory. All ingested logs are stored in the container's ephemeral filesystem. Any container restart (update, crash, `docker-compose down`) loses all log history.
- **Risk:** Loss of operational logs needed for debugging, audit trails, and incident investigation.
- **Fix:** Add a named volume: `volumes: [loki_data:/loki]` and configure Loki's storage path.
- **Effort:** Small (10 minutes)

---

### [M13] `INTERNAL_API_SECRET` Falls Back to Empty String
- **Category:** Security > Configuration
- **File(s):** `middleware/src/modules/displays/displays.service.ts:208,381,499`, `middleware/src/modules/playlists/playlists.service.ts:433`
- **Description:** Internal API calls between services use `process.env.INTERNAL_API_SECRET || ''` as an auth header. If the env var is not set, requests are sent with an empty API key. This is not validated at startup like `JWT_SECRET` is.
- **Risk:** If `INTERNAL_API_SECRET` is missing in production, internal service-to-service calls will either fail silently or succeed without auth (depending on how the receiving service validates the key).
- **Fix:** Add `INTERNAL_API_SECRET` to the required env vars check in `middleware/src/main.ts:37` for production.
- **Effort:** Small (5 minutes)

---

### [M14] Fire-and-Forget Content Push to Devices
- **Category:** Reliability > Device Communication
- **File(s):** `realtime/src/gateways/device.gateway.ts:862,871`
- **Description:** Content updates and commands are pushed to devices via `this.server.to(room).emit(event, data)` -- fire-and-forget with no acknowledgment. If a device is momentarily disconnected or the message is lost, the device never receives the update.
- **Risk:** Devices may display stale content indefinitely if they miss an update push. No retry or delivery confirmation mechanism exists.
- **Fix:** (1) Use Socket.IO acknowledgment callbacks (`emit(event, data, ackCallback)`). (2) Add a "last update timestamp" that devices can compare on reconnect. (3) Devices should poll for updates on reconnect.
- **Effort:** Medium (3-4 hours)

---

### LOW Issues (10)

---

### [L1] MongoDB Listed in Docker Compose but Not Actively Used
- **Category:** DevOps > Infrastructure
- **File(s):** `docker/docker-compose.yml`
- **Description:** MongoDB is provisioned but no service code uses it.
- **Fix:** Remove until needed.
- **Effort:** Small

---

### [L2] ClickHouse Provisioned but Not Integrated
- **Category:** DevOps > Infrastructure
- **File(s):** `docker/docker-compose.yml`
- **Description:** ClickHouse runs but no application code reads from or writes to it.
- **Fix:** Remove until analytics migration.
- **Effort:** Small

---

### [L3] Display (Electron) Client Has No Test Coverage
- **Category:** Code Quality > Testing
- **File(s):** `display/` directory
- **Description:** Zero test files for the Electron display client.
- **Fix:** Add basic tests for WebSocket connection, heartbeat, content rendering, error recovery.
- **Effort:** Large (8+ hours)

---

### [L4] `DOMPurify` XSS Vulnerability (Moderate Severity)
- **Category:** Security > Dependencies
- **File(s):** `web/package.json` (transitive dependency)
- **Description:** DOMPurify has a moderate XSS vulnerability, but the web frontend does not use raw HTML injection.
- **Fix:** Update to patched version.
- **Effort:** Small

---

### [L5] Web Admin Test Suites Fail (Known -- RSC Migration)
- **Category:** Code Quality > Testing
- **File(s):** `web/src/app/admin/__tests__/organizations-page.test.tsx`, `admin-dashboard.test.tsx`
- **Description:** 2 admin test suites (15 tests) fail due to async Server Component patterns in jsdom. Known, tied to RSC migration deferral.
- **Fix:** Complete RSC migration or update tests.
- **Effort:** Large

---

### [L6] Sentry Integration Not Active
- **Category:** DevOps > Monitoring
- **File(s):** `middleware/src/config/sentry.config.ts`, `realtime/src/config/sentry.config.ts`
- **Description:** Sentry is conditionally activated by `SENTRY_DSN`. If not set, no error tracking.
- **Fix:** Configure `SENTRY_DSN` in production `.env`.
- **Effort:** Small

---

### [L7] Device Content Controller Has No Test Coverage
- **Category:** Code Quality > Testing
- **File(s):** `middleware/src/modules/content/device-content.controller.ts`
- **Description:** No test file exists for `device-content.controller.ts`. This controller is `@Public()` and manually verifies device JWT tokens -- a critical security path with zero automated tests.
- **Risk:** Changes to the device content endpoint could break device authentication without detection.
- **Fix:** Add unit tests covering: valid device JWT, expired device JWT, wrong org scope, content serving flow.
- **Effort:** Medium (2-3 hours)

---

### [L8] Backup Script Exists but Never Runs Actual Backups
- **Category:** DevOps > Data Management
- **File(s):** `scripts/ops/db-maintainer.ts:228-236`
- **Description:** The db-maintainer ops agent has a backup verification placeholder that checks if `BACKUP_S3_BUCKET` is set, but it only *verifies* existing backups -- it does not *create* them. There is no scheduled backup creation in any PM2 cron or system cron.
- **Risk:** No automated database backups. A disk failure or accidental data deletion is unrecoverable.
- **Fix:** Add `pg_dump` to the db-maintainer agent or schedule it via cron. Upload to S3/MinIO.
- **Effort:** Medium (2-3 hours)

---

### [L9] No Device Token Rotation Mechanism
- **Category:** Security > Device Communication
- **File(s):** `middleware/src/modules/displays/pairing.service.ts:245` (expiresIn: '90d')
- **Description:** Device JWT tokens expire after 90 days with NO rotation mechanism. When a device connects via WebSocket with a token nearing expiry, no new token is issued. The device must re-pair after expiry. User tokens have a `refresh()` method (`auth.service.ts:220-241`) but no equivalent exists for device tokens.
- **Fix:** Add token rotation in the WebSocket gateway: when a device connects with a token expiring within 14 days, emit a `token:refresh` event with a new 90-day token.
- **Effort:** Medium (2 hours)

---

### [L10] No Data Retention Policy for Audit Logs / Analytics / Notifications
- **Category:** DevOps > Data Management
- **File(s):** `packages/database/prisma/schema.prisma` (AuditLog ~line 393, ContentImpression ~line 276, Notification ~line 445)
- **Description:** Several models accumulate records indefinitely with no TTL or cleanup:
  - **AuditLog**: Every user action logged, never purged. Will grow to millions of rows.
  - **ContentImpression**: Analytics records per content view, never purged.
  - **Notification**: In-app notifications, never purged.
  - **PasswordResetToken**: Expired tokens have `expiresAt` but are never auto-deleted from DB.
- **Risk:** Database bloat over months/years. Query performance degrades. Storage costs increase.
- **Fix:** Add cron jobs to purge records older than retention period (e.g., 90 days for audit logs, 365 days for analytics, 30 days for notifications, immediate for expired password tokens).
- **Effort:** Medium (2-3 hours)

---

### [L11] No Remote Device Disable/Lock/Wipe Capability
- **Category:** Security > Device Communication
- **File(s):** `realtime/src/types/index.ts:40-51` (DeviceCommandType enum)
- **Description:** The supported device commands are: `RELOAD`, `RESTART`, `UPDATE_CONFIG`, `CLEAR_CACHE`, `SCREENSHOT`, `REBOOT`, `SKIP_CONTENT`, `PAUSE`, `RESUME`, `PUSH_CONTENT`. There is no `DISABLE`, `LOCK`, or `WIPE` command. Force-disconnecting a device via `client.disconnect()` is temporary -- the device can immediately reconnect.
- **Risk:** If a device is stolen or compromised, there is no way to remotely prevent it from accessing content. An admin cannot lock a device to prevent unauthorized display of content in an uncontrolled location.
- **Fix:** Add a `DISABLE` command that puts the device in a locked state (shows blank screen or lock message). Persist the disabled flag in DB so it survives reconnects.
- **Effort:** Medium (3-4 hours)

---

### [L12] No `.dockerignore` at Repository Root
- **Category:** DevOps > Infrastructure
- **File(s):** `.dockerignore` exists only at `docker/.dockerignore`, not at repo root
- **Description:** Without a root `.dockerignore`, Docker builds from the repo root will copy `node_modules`, `.git`, test artifacts, screenshots, etc. into the build context, dramatically increasing build time and image size.
- **Fix:** Add a root `.dockerignore` with: `node_modules`, `.git`, `*.md`, `screenshots/`, `test-screenshots/`, `logs/`, `.env*`.
- **Effort:** Small (5 minutes)

---

## What's Working Well (Strengths)

These areas demonstrate **production-quality engineering**:

### Security
1. **Global JWT auth guard** -- All endpoints require auth by default. Public endpoints explicitly opt-in with `@Public()`.
2. **Multi-tenancy isolation** -- `@CurrentUser('organizationId')` consistently extracts org ID from JWT. 131+ instances across 20 controllers.
3. **bcrypt with 14 rounds** -- OWASP 2025+ recommendation followed. Configurable via env var.
4. **Account lockout** -- 10 failed attempts, 15-min Redis-backed lockout, timing-safe comparison.
5. **httpOnly cookies with SameSite** -- JWT in httpOnly cookie, secure in production, SameSite strict.
6. **CSRF protection** -- Double-submit cookie pattern with timing-safe comparison.
7. **Input sanitization** -- Global `SanitizeInterceptor` on all inputs AND outputs. Template HTML fields get permissive sanitization.
8. **File upload validation** -- Magic number verification, storage quota enforcement, filename sanitization, suspicious content detection.
9. **SSRF protection** -- `FileValidationService.validateUrl()` blocks private IPs, cloud metadata endpoints, localhost, with DNS resolution check.
10. **No raw HTML injection** -- Zero instances of unsafe HTML rendering in the web frontend.
11. **Metrics endpoint requires auth** -- `MetricsController` at `/api/v1/internal/metrics` is protected by global JWT guard.

### Architecture
1. **Dual JWT system** -- Separate secrets for users and devices.
2. **WebSocket security** -- Connection + message rate limiting, JWT auth, org DB verification, device deduplication.
3. **Response envelope pattern** -- Consistent wrapping with `@SkipEnvelope()` opt-out.
4. **Global exception filter** -- Catches all unhandled exceptions, hides stack traces in production.
5. **Storage circuit breaker** -- MinIO operations use a circuit breaker pattern (`storage.service.ts`).
6. **Compression enabled** -- gzip with 1KB threshold, level 6.
7. **Helmet security headers** -- CSP in production, standard security headers.
8. **Request timeouts** -- 30s default, 120s for file uploads.
9. **Proper Prisma schema** -- 42 onDelete rules, comprehensive indexes, unique constraints.

### Testing
1. **1,734 middleware tests all passing** -- Comprehensive unit test coverage.
2. **205 realtime tests all passing** -- Good WebSocket gateway coverage.
3. **CI/CD pipeline** -- Lint, test, build, e2e, and security audit jobs.
4. **174 test files** -- Substantial test infrastructure.

### Operations
1. **PM2 cluster mode** -- Middleware runs 2 instances for HA.
2. **6 autonomous ops agents** -- Health monitoring, content lifecycle, fleet management.
3. **Grafana dashboards** -- Pre-provisioned monitoring.
4. **Prometheus with 30-day retention** -- Metric persistence configured.

---

## Priority Fix Order

### Immediate (before production traffic)
1. **C5: Math.random() temp password** -- 10-minute fix, direct crypto vulnerability
2. **C6: Cross-org cron job** -- 30-minute fix, data leakage risk
3. **C4: Redis-down brute force** -- 1-hour fix, auth bypass risk
4. **H2: LoginDto @MaxLength** -- 5-minute fix, DoS vector
5. **H6: WebSocket cookie mismatch** -- 5-minute fix, silent auth failures
6. **H13: decodeHtmlEntities XSS** -- 30-minute fix, re-introduces XSS vectors
7. **H14: Math.random request IDs** -- 5-minute fix, predictable IDs

### Before launch (week 1)
8. **C2: Dependency vulnerabilities** -- Assess and update multer/fast-xml-parser/serialize-javascript
9. **C3: enableImplicitConversion** -- Audit DTOs and switch to explicit transforms
10. **H7: Password reset race** -- Add atomic check-and-set transaction
11. **H5: UUID validation** -- Mechanical addition of `ParseUUIDPipe`
12. **H10: WsExceptionFilter** -- Create and apply to DeviceGateway
13. **H11: SupportRequest onDelete** -- Add Cascade + migration
14. **H12: Local disk fallback** -- Make MinIO required in production
15. **M13: INTERNAL_API_SECRET validation** -- Add to startup check

### First month
16. **C1: Git history secrets** -- Verify rotation, consider history purge
17. **H1: Token revocation** -- Implement Redis-based JTI blacklist
18. **H8: CI continue-on-error** -- Remove from test steps
19. **H9: GDPR data deletion** -- Implement org purge endpoint
20. **M1-M14: Remaining medium items** -- Prioritize by effort/impact
21. **L1-L12: Low items** -- Scheduled over following sprints

---

## Test Results Summary

| Service | Suites | Tests | Status |
|---------|--------|-------|--------|
| Middleware | 84 | 1,734 | **ALL PASS** |
| Realtime | 9 | 205 | **ALL PASS** |
| Web | 70/73 | 791/819 | 3 suites fail (known RSC issue) |
| Display | 0 | 0 | No tests |
| **Total** | **163+** | **2,730+** | **~99% pass** |

**Builds:** All 3 services compile successfully via Nx.

---

## Conclusion

Vizora is **conditionally production-ready** with important caveats. The security fundamentals are strong -- authentication, authorization, and multi-tenancy isolation are well-implemented. However, the expanded audit reveals 6 CRITICAL issues that must be addressed before production traffic:

1. **C4: Redis-down brute force bypass** -- Auth lockout fails open
2. **C5: Math.random() passwords** -- Predictable temporary passwords
3. **C6: Cross-org cron job** -- Content leakage between organizations
4. **C2: Dependency vulnerabilities** -- Especially multer (file uploads)
5. **C3: Implicit type conversion** -- Validation bypass risk
6. **C1: Git history secrets** -- Verify rotation

Items C4, C5, C6, and the quick HIGH fixes (H2, H6, H13, H14) can be resolved in under 2 hours of focused work. The dependency updates (C2) and implicit conversion fix (C3) require more careful testing.

With CRITICAL and HIGH fixes applied, the codebase would score **85-90/100** for production readiness. The codebase is well-structured, extensively tested (2,730+ tests), and follows NestJS best practices. The autonomous operations system provides monitoring coverage that many larger platforms lack.

---

**PHASE 1 COMPLETE. Awaiting review before Phase 2 implementation.**
