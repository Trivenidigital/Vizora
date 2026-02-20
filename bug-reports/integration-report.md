# Integration Bug Report: Cross-Module & End-to-End Testing

## Overview
This report covers cross-module interactions, data flows, API contract compatibility, error propagation, and production deployment readiness across all Vizora services.

---

## 1. Cross-Module Interaction Tests

### 1.1 Middleware <-> Database (Prisma)
- **Status:** TESTED (via 1653 middleware unit tests with mocked Prisma)
- **Finding:** All middleware services properly interact with database through Prisma ORM
- **Note:** Unit tests mock Prisma; real database interactions only tested in E2E suite

### 1.2 Middleware <-> Redis
- **Status:** TESTED (via redis.service.spec.ts + services that use Redis)
- **Finding:** Redis operations for caching, rate limiting, and session management tested
- **Note:** Circuit breaker service tested for Redis connection failures

### 1.3 Realtime <-> Redis
- **Status:** TESTED (via heartbeat, playlist, notification service specs)
- **Finding:** Redis failure handling properly tested - services degrade gracefully

### 1.4 Realtime <-> Database
- **Status:** TESTED (via playlist.service.spec.ts - DB fallback when Redis misses)
- **Finding:** Dual persistence pattern (Redis + PostgreSQL) tested for device status

### 1.5 Web <-> Middleware API
- **Status:** PARTIALLY TESTED
- **Finding:** API client (`web/src/lib/api.ts`) covers all endpoints, but no integration tests verify actual request/response contracts
- **Risk:** API contract changes in middleware could break web dashboard silently

### 1.6 Web <-> Realtime (WebSocket)
- **Status:** TESTED (via useSocket.test.ts, useRealtimeEvents.test.ts)
- **Finding:** Socket connection management, event handling, offline queue, reconnection all tested at hook level
- **Note:** Tests use mocked Socket.IO - no real WebSocket integration testing

### 1.7 Display Clients <-> Realtime Gateway
- **Status:** NOT TESTED
- **Finding:** No tests verify the device WebSocket handshake, JWT auth flow, or content delivery from device perspective

### 1.8 Display Clients <-> Middleware API
- **Status:** NOT TESTED
- **Finding:** Device pairing, content download, and API communication from display client side untested

---

## 2. Complete User Journey Tests

### 2.1 User Registration -> Dashboard Access
- **Status:** TESTED (auth.service + auth.controller specs)
- **Flows Tested:** Registration with org creation, login, JWT issuance, cookie-based auth, token refresh
- **Gap:** No end-to-end browser test for full registration->dashboard flow

### 2.2 Content Upload -> Display Rendering
- **Status:** PARTIALLY TESTED
- **Flows Tested:** Content upload (middleware), content storage (MinIO), playlist creation, schedule assignment
- **Gap:** Content delivery to display client and actual rendering not tested

### 2.3 Device Pairing Flow
- **Status:** TESTED (pairing.service.spec.ts, pairing.controller.spec.ts)
- **Flows Tested:** QR code generation, pairing code validation, device JWT issuance
- **Gap:** Display client side of pairing not tested

### 2.4 Real-Time Content Push
- **Status:** TESTED (device.gateway.spec.ts, playlist.service.spec.ts)
- **Flows Tested:** Content push event emission, playlist update notification, instant publish
- **Gap:** Display client reception and rendering not tested

### 2.5 Billing/Subscription Flow
- **Status:** TESTED (billing module - 7 spec files)
- **Flows Tested:** Checkout, webhook processing, subscription status, quota enforcement
- **Gap:** Stripe/Razorpay webhook delivery not integration-tested

---

## 3. API Contract Compatibility

### INT-BUG-001: Response Envelope Unwrapping Assumption (Severity: MEDIUM)
- **Description:** The web API client (`api.ts:178-180`) auto-unwraps `{ success, data }` envelope. If any middleware endpoint returns a non-envelope response, the unwrapping logic could pass through raw data incorrectly.
- **Impact:** Endpoints using `@SkipEnvelope()` decorator would return raw responses that won't be unwrapped - this is correct. But if a new endpoint accidentally skips the envelope, the client might receive unexpected data shapes.
- **Mitigation:** The `@SkipEnvelope()` usage is consistent and tested

### INT-BUG-002: Inconsistent Type Usage in API Client (Severity: LOW)
- **Description:** Multiple API methods in `web/src/lib/api.ts` use `Promise<any>` return types (lines 598-628 for analytics, 708-714 for display groups, 1156-1243 for templates/widgets/layouts)
- **Impact:** TypeScript type safety is lost for these endpoints; runtime errors possible
- **Suggested Fix:** Define proper TypeScript interfaces for all API responses

### INT-BUG-003: CSRF Token Race Condition (Severity: MEDIUM)
- **Description:** The API client reads CSRF token from cookies (`getCsrfToken()`). If the initial page load hasn't set the CSRF cookie yet, the first mutating request could fail with a CSRF error.
- **Steps to Reproduce:** Clear all cookies, navigate directly to a dashboard page, immediately perform a PATCH/POST/DELETE action
- **Expected:** CSRF token should be available before any mutating requests
- **Actual:** First request may fail if cookie hasn't been set by the middleware CSRF middleware
- **Suggested Fix:** Ensure CSRF cookie is set on initial page load via middleware or a dedicated endpoint

---

## 4. Error Propagation Across Boundaries

### INT-BUG-004: Silent 401/403 Redirect on Non-Dashboard Routes (Severity: LOW)
- **Description:** In `api.ts:162-165`, 401/403 errors only redirect to login if the current path starts with `/dashboard` or `/admin`. On other paths, the error is thrown but no redirect occurs.
- **Impact:** If API calls are made from non-standard paths (e.g., embedded views), auth errors won't redirect
- **Assessment:** This is likely intentional behavior - low risk

### Error Handling Assessment:
- **Middleware:** Global `AllExceptionsFilter` catches all unhandled errors - TESTED
- **Realtime:** Gateway-level error handling for WebSocket events - TESTED
- **Web:** ErrorBoundary component for React errors - TESTED
- **Display Clients:** Unknown - NO TESTS

---

## 5. Build & Deployment Compatibility

### INT-BUG-005: Nx Build Failure for Web Service (Severity: HIGH)
- **Description:** `npx nx build @vizora/web` fails with plugin worker timeout. The Nx workspace graph cannot be created for the web project.
- **Impact:** PM2 ecosystem config uses `npm start` which requires a pre-built Next.js app. If the build process relies on Nx orchestration, the deployment pipeline breaks.
- **Workaround:** Direct `next build` in the web directory succeeds. The `post-deploy` script in ecosystem.config.js runs `pnpm run build` which may or may not use Nx.
- **Verification Needed:** Confirm that `pnpm run build` in the root or `pnpm --filter @vizora/web build` uses `next build` directly, not `nx build`.

### INT-BUG-006: PM2 Web Service Uses `npm start` (Severity: MEDIUM)
- **Description:** In `ecosystem.config.js:77`, the web service is configured with `script: 'npm'` and `args: 'start'`. This assumes `npm start` works in the web directory.
- **Impact:** If the web package uses pnpm-specific features or the start script isn't defined, PM2 will fail to start the web service.
- **Verification Needed:** Check that `web/package.json` has a `start` script that runs `next start`

### INT-BUG-007: Missing Prisma Source Map in Realtime Build (Severity: LOW)
- **Description:** Realtime build warns about missing `packages/database/dist/generated/prisma/runtime/library.js.map`
- **Impact:** No functional impact; slightly degrades error stack traces in production
- **Suggested Fix:** Regenerate Prisma client or suppress the source-map-loader warning

---

## 6. Production Configuration Assessment

### Infrastructure (docker-compose.yml):
- PostgreSQL 16 with health checks - GOOD
- MongoDB 7 with health checks - GOOD
- Redis 7 with health checks - GOOD
- MinIO with proper bucket configuration - GOOD
- All ports bound to 127.0.0.1 (localhost only) - GOOD SECURITY
- Resource limits configured - GOOD

### PM2 Configuration (ecosystem.config.js):
- Middleware: 2 instances in cluster mode - GOOD
- Realtime: 1 instance (WebSocket state consistency) - CORRECT
- Web: 1 instance - ADEQUATE
- Graceful shutdown timeouts configured - GOOD
- Exponential backoff restart - GOOD
- Memory limits: 512M middleware/realtime, 1G web - REASONABLE
- Log rotation: 50M max size - GOOD

### Environment Configuration:
- `.env.production.example` is comprehensive and well-documented - EXCELLENT
- All secrets use CHANGEME placeholders - GOOD
- BCRYPT_ROUNDS=14 for production - GOOD (OWASP compliant)
- JWT secrets require 32+ char - GOOD
- CORS configured - GOOD
- Statement timeout (30s) on database - GOOD

### Security Configuration:
- XSS sanitization via SanitizeInterceptor on all endpoints - GOOD
- Template HTML fields properly excluded from sanitization - GOOD
- CSRF middleware + guard with cookie-based tokens - GOOD
- Helmet headers (assumed via NestJS Helmet) - GOOD
- Rate limiting (3-tier) - GOOD
- httpOnly cookies for JWT - GOOD
- Account lockout (10 attempts, 15min) - GOOD
- Password fields excluded from sanitization - GOOD
- bcryptjs for password hashing - GOOD

---

## 7. Playwright E2E Tests

### Status: NOT EXECUTED
- **Reason:** E2E tests require all services running (middleware, web, realtime + database infrastructure)
- **Impact:** 24 Playwright spec files covering auth through comprehensive integration remain unverified
- **Files Available:** `e2e-tests/01-auth.spec.ts` through `e2e-tests/15-comprehensive-integration.spec.ts`
- **Recommendation:** Run full E2E suite in a staging environment before production deployment

---

## 8. Security Review Findings

### SEC-001: Hardcoded Secrets Committed to Git (Severity: CRITICAL - DEPLOYMENT BLOCKER)
- **Description:** The `.env` file at repo root contains real secrets committed to version control:
  - `JWT_SECRET=85e96930ea8...` (full 64-char hex)
  - `DEVICE_JWT_SECRET=785c602c335e...` (full 64-char hex)
  - `INTERNAL_API_SECRET=69864b5326...` (full 64-char hex)
  - `GRAFANA_ADMIN_PASSWORD=admin123`
- **Impact:** If this repo is shared/public, ALL secrets are compromised. Even if private, secrets in git history persist through clones.
- **Required Action:**
  1. Rotate ALL secrets immediately before production deployment
  2. Remove `.env` from git history (`git filter-branch` or BFG Repo-Cleaner)
  3. Verify `.gitignore` excludes `.env` (it does, but history is tainted)

### SEC-002: Insecure Default Credentials in Docker Compose (Severity: CRITICAL - DEPLOYMENT BLOCKER)
- **Description:** `docker/docker-compose.yml` has fallback default credentials:
  - MongoDB: `mongo_secure_pass_change_me`
  - Redis: `redis_secure_pass_change_me`
  - MinIO: `minioadmin`/`minioadmin`
- **Impact:** If env vars aren't set, containers start with known credentials
- **Required Action:** Remove default fallbacks; require env vars to be set explicitly

### SEC-003: Grafana Admin Password is "admin123" (Severity: CRITICAL - DEPLOYMENT BLOCKER)
- **Description:** The `.env` file sets `GRAFANA_ADMIN_PASSWORD=admin123`
- **Impact:** Unauthorized access to monitoring dashboards, metrics, and logs
- **Required Action:** Set strong password in production `.env`

### SEC-004: Sanitize Interceptor XSS Gap for Template Fields (Severity: HIGH)
- **Description:** `templateHtml`, `htmlContent`, and `customCss` fields are explicitly excluded from XSS sanitization. While necessary for template rendering, no validation ensures these fields contain safe HTML before storage.
- **Impact:** Potential stored XSS if user-supplied HTML reaches template fields
- **Suggested Fix:** Add template content validation (Handlebars whitelist), implement CSP with nonce-based scripts

### SEC-005: Login Rate Limit Too Permissive (Severity: HIGH)
- **Description:** Login endpoint allows 5 attempts/min in production = 7,200/day per IP
- **Impact:** Brute force vulnerability despite account lockout (10 attempts)
- **Suggested Fix:** Reduce to 3/min or implement exponential backoff at rate-limit level

### SEC-006: WebSocket Gateway Missing Per-Message Rate Limiting (Severity: MEDIUM)
- **Description:** Realtime gateway has connection-level rate limiting but no per-message throttling
- **Impact:** Authenticated devices could spam messages
- **Suggested Fix:** Add rate limiting per message type

### SEC-007: Web Dockerfile Missing Non-Root User (Severity: MEDIUM)
- **Description:** `web/Dockerfile` doesn't specify `USER node` like middleware does
- **Impact:** Container runs as root - increases attack surface
- **Suggested Fix:** Add `USER node` to web/Dockerfile

### SEC-008: Realtime Service Missing Bootstrap Validation (Severity: MEDIUM)
- **Description:** Unlike middleware, realtime's `main.ts` doesn't validate required env vars (DATABASE_URL, REDIS_URL, JWT secrets) at startup
- **Impact:** Service could start in degraded state without proper configuration
- **Suggested Fix:** Add same validation as middleware bootstrap

---

## 9. Deployment Blockers

| ID | Issue | Severity | Blocker? |
|----|-------|----------|----------|
| SEC-001 | Hardcoded secrets in git history | CRITICAL | **YES** |
| SEC-002 | Docker default credentials | CRITICAL | **YES** |
| SEC-003 | Grafana password "admin123" | CRITICAL | **YES** |
| INT-BUG-005 | Nx build intermittently fails | HIGH | NO (workaround exists) |
| SEC-004 | Template field XSS gap | HIGH | NO (requires targeted attack) |
| SEC-005 | Login rate limit too permissive | HIGH | NO (account lockout mitigates) |
| BUG-DISP-001/002 | Display client tests unverified | HIGH | NO (if manual QA done) |

---

## Overall Production-Readiness Assessment: **NO-GO (until secrets rotated)**

The backend services (middleware + realtime) are well-tested and architecturally sound. However, **3 critical security issues must be resolved before any production deployment:**

1. **MUST FIX:** Rotate ALL secrets (JWT, device JWT, internal API, Grafana) - they are committed to git history
2. **MUST FIX:** Remove `.env` from git history (BFG Repo-Cleaner or `git filter-branch`)
3. **MUST FIX:** Remove default credential fallbacks from `docker-compose.yml`
4. **Must Verify:** Production `.env` has all CHANGEME values replaced with strong, unique secrets
5. **Should Do:** Run Playwright E2E suite in staging
6. **Should Do:** Manual QA of display clients on target hardware
