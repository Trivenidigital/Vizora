# Vizora Security & Authentication Review

**Reviewer:** Security Agent (Claude Opus 4.6)
**Date:** 2026-02-09
**Branch:** feat/phase-3-major-features
**Scope:** Full security audit of middleware, realtime, and web services

---

## Executive Summary

The Vizora codebase demonstrates **strong security fundamentals** with well-implemented authentication, authorization, input validation, and XSS protection. The dual JWT architecture (user vs. device) is correctly separated, CSRF uses the double-submit cookie pattern with timing-safe comparison, and Prisma ORM prevents SQL injection by default. Several medium/low-severity findings should be addressed before production pilot, but no critical vulnerabilities were identified.

**Overall Security Rating: B+ (Good, with actionable improvements needed)**

---

## 1. Authentication & Authorization

### 1.1 JWT Implementation

**Rating: STRONG**

| Aspect | Status | Details |
|--------|--------|---------|
| Separate user/device secrets | PASS | `JWT_SECRET` and `DEVICE_JWT_SECRET` with independent keys |
| Minimum secret length enforced | PASS | 32-char minimum validated at startup (`middleware/src/modules/auth/strategies/jwt.strategy.ts:45-48`, `middleware/src/modules/auth/auth.module.ts:19-21`) |
| Algorithm pinned to HS256 | PASS | Both sign and verify pin to `HS256`, preventing algorithm confusion attacks (`jwt.strategy.ts:56`, `auth.module.ts:28-30`) |
| Token expiration | PASS | 7-day expiry for user tokens, 365-day for device tokens, `ignoreExpiration: false` |
| JTI (JWT ID) for revocation | PASS | `crypto.randomUUID()` in token payload enables token revocation (`auth.service.ts:251`) |
| Token revocation on logout | PASS | Tokens blacklisted in Redis with TTL matching remaining token life (`auth.service.ts:265-296`) |
| Revocation check on every request | PASS | `jwt.strategy.ts:67-72` checks Redis revocation list on validation |
| Device token type rejection in user auth | PASS | `jwt.strategy.ts:62-64` explicitly rejects `type: 'device'` tokens |
| User validated on every request | PASS | `jwt.strategy.ts:75-81` fetches user from DB, checks `isActive` |
| Password hash excluded from responses | PASS | `auth.service.ts:298-300` destructures `passwordHash`, `auth.controller.ts:218` also strips it |

**Findings:**

- **(Medium) F-1: Device JWT token expiry is very long (365 days)**
  File: `middleware/src/modules/displays/pairing.service.ts:247`
  Device tokens are signed with `expiresIn: '365d'`. If a device token is compromised, it remains valid for up to a year. Consider 30-90 day tokens with a refresh mechanism, or periodic token rotation.

- **(Low) F-2: Token refresh does not revoke the previous token**
  File: `middleware/src/modules/auth/auth.service.ts:198-214`
  The `refresh()` method generates a new token but does not revoke the old one. An attacker with a stolen token could continue using it even after the legitimate user refreshes. Consider revoking the incoming token during refresh.

### 1.2 Cookie Security

**Rating: STRONG**

| Aspect | Status | Details |
|--------|--------|---------|
| httpOnly | PASS | Set on auth cookie (`auth.controller.ts:40`) |
| Secure flag in production | PASS | `secure: isProduction` (`auth.controller.ts:41`) |
| SameSite | PASS | `strict` in production, `lax` in development (`auth.controller.ts:42`) |
| Path scoped | PASS | `path: '/'` |
| No domain set | PASS | Correctly scoped to exact origin host |
| Cookie cleared on logout | PASS | `clearAuthCookie()` mirrors same options (`auth.controller.ts:58-73`) |

No findings. Cookie implementation is solid.

### 1.3 Account Security

**Rating: STRONG**

| Aspect | Status | Details |
|--------|--------|---------|
| Account lockout | PASS | 10 failed attempts triggers 15-minute lockout via Redis (`auth.service.ts:18-19, 126-135`) |
| Anti-enumeration | PASS | Failed login for non-existent users still increments counter and returns same error (`auth.service.ts:144-146`) |
| Strong password policy | PASS | Min 8 chars, uppercase, lowercase, number/special (`register.dto.ts:21-23`) |
| Bcrypt with configurable rounds | PASS | Default 14 rounds, configurable via `BCRYPT_ROUNDS` env var (`auth.service.ts:52`) |
| Inactive account check | PASS | `user.isActive` checked during login (`auth.service.ts:158-160`) |
| Device token hashed in DB | PASS | SHA-256 hash stored, not plaintext (`pairing.service.ts:252, 392-394`) |
| Audit logging | PASS | Registration, login, and logout events logged (`auth.service.ts:86-99, 175-183, 229-237`) |

### 1.4 Authorization / Guards

**Rating: STRONG**

| Aspect | Status | Details |
|--------|--------|---------|
| Global JWT guard | PASS | `JwtAuthGuard` applied as `APP_GUARD` (`auth.module.ts:42-44`) |
| Public decorator bypass | PASS | Only explicit `@Public()` routes skip auth (`jwt-auth.guard.ts:12-18`) |
| Role-based access control | PASS | `RolesGuard` with `@Roles()` decorator on write endpoints |
| Organization scoping | PASS | All data queries filter by `organizationId` from JWT payload |
| Admin controller protection | PASS | `SuperAdminGuard` on admin routes (`admin.controller.ts:56`) |

**Findings:**

- **(Medium) F-3: Template library read endpoints accessible to all authenticated users regardless of role**
  File: `middleware/src/modules/template-library/template-library.controller.ts:27-54`
  GET endpoints like `search()`, `getCategories()`, `findOne()`, `getPreview()` have `@UseGuards(RolesGuard)` but no `@Roles()` decorator, meaning any authenticated user (including `viewer` role) can access them. If the template library contains organization-specific templates, this could be an information disclosure issue. However, if the template library is intentionally a shared/global resource, this is acceptable.

- **(Medium) F-4: Webhook endpoints lack authentication**
  File: `middleware/src/modules/billing/webhooks.controller.ts:13-42`
  The Stripe and Razorpay webhook endpoints have no `@Public()` decorator but also no explicit auth guard applied at class level. They rely on the global JWT guard, which means the webhook calls from Stripe/Razorpay (which won't have JWT tokens) will be rejected. This appears to be a bug -- webhook endpoints should be `@Public()` and verify the webhook signature instead. The signature is passed to `billingService.handleWebhookEvent()` but the request will never reach that point due to JWT guard.

### 1.5 Public Endpoints Audit

All `@Public()` endpoints were reviewed and are appropriate:

| Endpoint | Controller | Justification |
|----------|-----------|---------------|
| `GET /api/health` | AppController | Health check |
| `GET /api/ready` | AppController | Readiness probe |
| `GET /health`, `GET /health/ready`, `GET /health/live` | HealthController | K8s probes |
| `POST /api/auth/register` | AuthController | Registration (rate limited) |
| `POST /api/auth/login` | AuthController | Login (rate limited + lockout) |
| `POST /api/devices/pairing/request` | PairingController | Unpaired devices (CSRF skipped) |
| `GET /api/devices/pairing/status/:code` | PairingController | Pairing status check |
| `POST /api/displays/:deviceId/heartbeat` | DisplaysController | Device JWT verified manually |
| `GET /api/schedules/active/:displayId` | SchedulesController | Device JWT verified manually |
| `GET /api/device-content/:id/file` | DeviceContentController | Device JWT verified manually |

All public endpoints that handle device requests implement manual device JWT verification with proper `DEVICE_JWT_SECRET` validation.

---

## 2. Input Validation & XSS Prevention

### 2.1 Global Validation Pipe

**Rating: STRONG**

File: `middleware/src/main.ts:82-93`

```
whitelist: true           -- strips unknown properties
forbidNonWhitelisted: true -- rejects requests with unknown properties
transform: true           -- auto-transforms to DTO types
disableErrorMessages: true (production) -- prevents info leakage
```

**Finding:**

- **(Low) F-5: `enableImplicitConversion: true` in ValidationPipe**
  File: `middleware/src/main.ts:88`
  Implicit conversion can lead to unexpected type coercion. For example, a string `"true"` becomes boolean `true`. While not a direct vulnerability due to `whitelist` and `forbidNonWhitelisted`, it weakens type safety. Consider using explicit `@Transform()` decorators instead.

### 2.2 SanitizeInterceptor (XSS)

**Rating: GOOD**

File: `middleware/src/modules/common/interceptors/sanitize.interceptor.ts`

- Strips all HTML tags from request body, query, and params using `sanitize-html`
- Correctly skips password fields to avoid corrupting hashed passwords
- Applied globally as an interceptor

**Finding:**

- **(Low) F-6: SanitizeInterceptor sanitizes input only, not output**
  File: `middleware/src/modules/common/interceptors/sanitize.interceptor.ts:22-37`
  The interceptor sanitizes `request.body`, `request.query`, and `request.params` but does not sanitize response data. If data enters the database through a channel that bypasses the interceptor (e.g., database seed scripts, direct DB manipulation, or WebSocket messages), it could be served unsanitized to the frontend. Defense-in-depth suggests also sanitizing output, though the current input sanitization is already good.

### 2.3 Template Rendering Security

**Rating: STRONG**

File: `middleware/src/modules/content/template-rendering.service.ts`

- Validates templates against forbidden tags (`script`, `iframe`, `object`, etc.), forbidden attributes (all `on*` event handlers), and forbidden protocols (`javascript:`, `data:`, `vbscript:`)
- Uses Handlebars with `noEscape: false` (auto-escaping enabled)
- Renders through `processTemplate()` which validates -> renders -> sanitizes with DOMPurify
- DOMPurify sanitization with explicit allow lists for tags and attributes
- Circuit breaker on external data source fetches with 10s timeout

**Finding:**

- **(Low) F-7: `renderTemplate()` method does not sanitize output**
  File: `middleware/src/modules/content/template-rendering.service.ts:199-216`
  The public `renderTemplate()` method (used by widget creation/update) compiles and renders without DOMPurify sanitization. Only `processTemplate()` includes the full validate -> render -> sanitize chain. Widget code paths use `renderTemplate()` directly (`content.service.ts:1041, 1105, 1156`). Consider ensuring all render paths use `processTemplate()`.

### 2.4 File Upload Validation

**Rating: STRONG**

File: `middleware/src/modules/content/file-validation.service.ts`

- MIME type whitelist with explicit allowed types
- File extension validation
- File size limits per type (10MB images, 100MB videos, 50MB PDFs)
- Magic number (file signature) verification to prevent MIME spoofing
- Suspicious content detection (script tags, JavaScript, eval, etc.)
- SHA-256 file hash for integrity/deduplication
- Filename sanitization with directory traversal prevention
- URL validation with SSRF protection (blocks private IPs, localhost, cloud metadata, link-local)
- DNS resolution check to prevent DNS rebinding SSRF

---

## 3. CSRF Protection

**Rating: STRONG**

### 3.1 CSRF Middleware (Primary Protection)

File: `middleware/src/modules/common/middleware/csrf.middleware.ts`

- Applied to all routes via `AppModule.configure()` (`app.module.ts:108-111`)
- Implements double-submit cookie pattern
- 32-byte cryptographically random token (`crypto.randomBytes(32)`)
- Constant-time comparison using `crypto.timingSafeEqual()` to prevent timing attacks
- Correctly skips safe methods (GET, HEAD, OPTIONS)
- Rejects requests missing the CSRF cookie (prevents cookie-stripping attacks)
- Appropriately exempts: `/auth/login`, `/auth/register`, `/devices/pairing` (rate-limited instead)

### 3.2 CSRF Guard (Additional Layer)

File: `middleware/src/modules/common/guards/csrf.guard.ts`

- Provides `@SkipCsrf()` decorator for routes that need exemption
- Same double-submit cookie validation with timing-safe comparison

No findings. CSRF implementation is well-designed.

---

## 4. Rate Limiting

**Rating: GOOD**

### 4.1 Global Rate Limiting

File: `middleware/src/app/app.module.ts:37-75`

Production limits:
- Short: 10 requests/second
- Medium: 100 requests/minute
- Long: 1000 requests/hour

Development limits are intentionally very permissive (1000x relaxed).

### 4.2 Endpoint-Specific Rate Limiting

File: `middleware/src/modules/auth/auth.controller.ts:86-91, 123-128`

- Register: 3 requests/minute in production, 1000 in dev
- Login: 5 requests/minute in production, 1000 in dev
- Account lockout: 10 failed attempts triggers 15-minute lockout (Redis-based)

**Findings:**

- **(Low) F-8: Rate limiting in development is effectively disabled**
  This is intentional per the codebase documentation ("100x relaxed in dev/test"), but there's no warning or test to verify production rate limits are actually applied correctly. Consider adding an integration test that verifies rate limits in production mode.

---

## 5. SQL Injection / Query Safety

**Rating: EXCELLENT**

All database interactions use Prisma ORM with parameterized queries. A thorough search for raw SQL found:

| File | Usage | Safe? |
|------|-------|-------|
| `app.controller.ts:25` | `$queryRaw\`SELECT 1\`` | SAFE - tagged template literal, no interpolation |
| `app.controller.ts:48` | `$queryRaw\`SELECT 1\`` | SAFE - health check, no user input |
| `health.service.ts` | `$queryRaw\`SELECT 1\`` | SAFE - health check only |
| `database.service.ts` | `$queryRaw\`SELECT 1\`` | SAFE - connectivity check |
| `platform-health.service.ts` | `$queryRaw\`SELECT 1\`` | SAFE - admin health check |

**No instances of `$queryRawUnsafe` or `$executeRawUnsafe` were found.**
**No string interpolation in any database queries.**

All content filter values are validated against whitelists (`content.service.ts:123-136`), preventing filter injection.

---

## 6. Dependency Security

### 6.1 Key Security Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `bcryptjs` | Password hashing | Correct choice (pure JS, no native build issues) |
| `sanitize-html` | Input XSS prevention | Actively maintained |
| `isomorphic-dompurify` | Output HTML sanitization | Industry standard |
| `helmet` | Security headers | Properly configured |
| `@nestjs/throttler` | Rate limiting | Native NestJS integration |
| `passport-jwt` | JWT strategy | Standard approach |
| `cookie-parser` | Cookie handling | Required for httpOnly cookies |

**Finding:**

- **(Low) F-9: No automated dependency vulnerability scanning configured**
  No evidence of `npm audit`, Snyk, or Dependabot configuration in the repository. Consider adding automated dependency scanning to CI/CD pipeline.

---

## 7. Secret Management

### 7.1 Environment Variables

**Rating: GOOD WITH CONCERNS**

**Positive:**
- `.env` files are properly `.gitignore`d (`.gitignore:23-29`)
- `.env.example` uses placeholder values (`GENERATE_A_SECURE_64_CHAR_HEX_SECRET_HERE`)
- `.env.production.example` is excellent: detailed instructions, `CHANGEME` placeholders, security notes
- Production startup validates required env vars (`main.ts:27-34`)
- JWT secret minimum length enforced at startup (`jwt.strategy.ts:45-48`, `auth.module.ts:19-21`)

**Findings:**

- **(High) F-10: Real secrets committed in `.env` files**
  Files: `C:\projects\vizora\.env:32-37`, `C:\projects\vizora\middleware\.env:12-14`
  While `.env` is in `.gitignore`, the actual `.env` files on the current branch contain real JWT secrets, Redis passwords, MongoDB credentials, and an `INTERNAL_API_SECRET`. These are development credentials, but if the `.gitignore` was ever misconfigured or someone force-committed, these would leak. The current git status shows `.env` files are NOT tracked, so this is not an active leak -- but the `.env.test` files ARE tracked (per `.gitignore:33` exception) and should be verified to not contain real secrets.

- **(Medium) F-11: MinIO default credentials in development**
  Files: `.env:27-28`, `middleware/.env:33-34`
  MinIO uses `minioadmin/minioadmin` which are the known default credentials. This is acceptable for local development only but must be changed for any shared or production environment. The `.env.production.example` correctly uses `CHANGEME` placeholders.

- **(Low) F-12: Database password `postgres:postgres` in development**
  Files: `.env:14`, `middleware/.env:9`, `packages/database/.env:2`
  Default PostgreSQL credentials. Acceptable for local development only.

### 7.2 No Hardcoded Secrets in Source Code

A comprehensive search of the source code found **no hardcoded secrets, API keys, or credentials** in any `.ts` files. All secrets are properly loaded from environment variables.

---

## 8. Headers & Transport Security

### 8.1 Helmet Configuration

**Rating: GOOD**

File: `middleware/src/main.ts:54-57`

```typescript
helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false, // Allow embedding for display clients
})
```

- CSP enabled in production
- COEP disabled intentionally (display clients need to embed content)
- All other Helmet defaults active (X-Frame-Options, X-Content-Type-Options, etc.)

### 8.2 CORS Configuration

**Rating: GOOD**

File: `middleware/src/main.ts:60-68`

- Production: Restricted to comma-separated `CORS_ORIGIN` env var
- Development: `origin: true` (allows all) -- acceptable for dev
- `credentials: true` for cookie-based auth
- Explicit allowed headers list including `X-CSRF-Token`

**Finding:**

- **(Medium) F-13: CORS allows all origins in development mode**
  File: `middleware/src/main.ts:62-63`
  `origin: true` in non-production mode allows any origin. While standard practice for development, this could be a problem if a "staging" environment runs with `NODE_ENV=development` (or unset). Recommend explicitly setting `NODE_ENV=production` as a deployment requirement.

### 8.3 WebSocket CORS

**Rating: GOOD**

File: `realtime/src/gateways/device.gateway.ts:44-47`

- Uses `CORS_ORIGIN` env var in production
- Falls back to `['http://localhost:3001']` only when env var is not set
- Credentials enabled for cookie-based auth

---

## 9. WebSocket Security

**Rating: STRONG**

File: `realtime/src/gateways/device.gateway.ts`

| Aspect | Status | Details |
|--------|--------|---------|
| Connection authentication | PASS | Device JWT verified on connect with `DEVICE_JWT_SECRET` (line 98-101) |
| Algorithm pinned | PASS | `algorithms: ['HS256']` on verify (line 100) |
| Token type validation | PASS | `payload.type !== 'device'` check (line 103) |
| Unauthenticated rejection | PASS | `client.disconnect()` if no token or invalid (lines 93, 105, 281) |
| Room authorization | PASS | `join:organization` and `join:room` verify org membership (lines 561-658) |
| Organization isolation | PASS | Devices join `device:{id}` and `org:{orgId}` rooms, scoped to their JWT claims |
| Screenshot size limit | PASS | 2MB base64 limit on screenshot data (line 699) |
| Input validation | PASS | `WsValidationPipe` on all `@SubscribeMessage` handlers |

**Finding:**

- **(Medium) F-14: Device JWT not checked against revocation list on WebSocket connect**
  File: `realtime/src/gateways/device.gateway.ts:87-107`
  The `handleConnection()` verifies the JWT signature and type but does not check if the token has been revoked (no Redis revocation check). A compromised device token that has been manually revoked would still allow WebSocket connections. Consider adding a revocation check against the Redis `revoked_token:*` keys.

---

## 10. Additional Security Observations

### 10.1 Error Handling (Good)

File: `middleware/src/modules/common/filters/all-exceptions.filter.ts`

- Production errors return generic "Internal server error" message
- Development errors include the actual error message for debugging
- Stack traces never exposed to clients
- All errors logged server-side

### 10.2 Logging Security (Good)

File: `middleware/src/modules/common/interceptors/logging.interceptor.ts`

- Request logging includes IP, user agent, user ID (for audit trail)
- Does not log request bodies (avoids logging passwords/sensitive data)
- Slow request detection (>1s warning)
- Request ID generation for tracing

### 10.3 Static File Serving (Acceptable)

File: `middleware/src/main.ts:41-48`

- `/static/` and `/uploads/` served via `useStaticAssets`
- No authentication on static files -- content URLs are generated with hash-based filenames, providing security through obscurity
- MinIO-stored content uses the authenticated `device-content/:id/file` endpoint instead

---

## Findings Summary

| ID | Severity | Finding | File |
|----|----------|---------|------|
| F-1 | **Medium** | Device JWT token expiry too long (365 days) | `pairing.service.ts:247` |
| F-2 | **Low** | Token refresh does not revoke previous token | `auth.service.ts:198-214` |
| F-3 | **Medium** | Template library read endpoints accessible to all roles | `template-library.controller.ts:27-54` |
| F-4 | **Medium** | Webhook endpoints will be blocked by global JWT guard | `webhooks.controller.ts:13-42` |
| F-5 | **Low** | `enableImplicitConversion` in ValidationPipe | `main.ts:88` |
| F-6 | **Low** | SanitizeInterceptor does not sanitize response output | `sanitize.interceptor.ts` |
| F-7 | **Low** | Widget `renderTemplate()` skips DOMPurify sanitization | `template-rendering.service.ts:199` |
| F-8 | **Low** | No tests verify production rate limits | `app.module.ts:37-75` |
| F-9 | **Low** | No automated dependency vulnerability scanning | Project-wide |
| F-10 | **High** | Real secrets in .env files (development, not committed) | `.env`, `middleware/.env` |
| F-11 | **Medium** | MinIO default credentials in development | `.env:27-28` |
| F-12 | **Low** | Default PostgreSQL credentials in development | `.env:14` |
| F-13 | **Medium** | CORS allows all origins when not in production mode | `main.ts:62-63` |
| F-14 | **Medium** | No token revocation check on WebSocket connection | `device.gateway.ts:87-107` |

**Severity Distribution:**
- Critical: 0
- High: 1 (development .env secrets -- not currently committed to git)
- Medium: 6
- Low: 7

---

## Recommendations (Priority Order)

### Before Pilot Launch (Must Fix)

1. **F-4**: Add `@Public()` decorator to webhook endpoints and verify signature within the handler (or ensure the billing module is disabled if not used)
2. **F-10**: Rotate all development secrets if they were ever exposed; verify `.env.test` and `.env.load-test` files do not contain production-grade secrets
3. **F-14**: Add Redis revocation check in WebSocket `handleConnection()`

### Before Production (Should Fix)

4. **F-1**: Reduce device token expiry to 30-90 days with a refresh mechanism
5. **F-13**: Ensure all non-local environments explicitly set `NODE_ENV=production`
6. **F-7**: Route widget rendering through `processTemplate()` instead of `renderTemplate()`
7. **F-3**: Add explicit `@Roles()` to template library read endpoints if they should be restricted
8. **F-9**: Add `npm audit` or Snyk to CI pipeline

### Nice-to-Have Improvements

9. **F-2**: Revoke previous token on refresh
10. **F-5**: Replace `enableImplicitConversion` with explicit `@Transform()` decorators
11. **F-6**: Add output sanitization as defense-in-depth
12. **F-8**: Add production rate limit integration tests

---

## Security Architecture Strengths

1. **Dual JWT separation** -- User and device auth are fully isolated with separate secrets, preventing cross-authentication attacks
2. **Defense-in-depth on XSS** -- Input sanitization (SanitizeInterceptor) + template validation + DOMPurify output sanitization
3. **SSRF protection** -- Comprehensive URL validation with DNS resolution checks, private IP blocking, and cloud metadata endpoint blocking
4. **CSRF implementation** -- Double-submit cookie with timing-safe comparison is a strong pattern
5. **Token revocation** -- JTI-based revocation with Redis TTL matching token expiry
6. **Organization data isolation** -- All queries scoped to `organizationId` from JWT claims
7. **Device token hashing** -- SHA-256 hash stored in DB, plaintext only in Redis during pairing (time-limited)
8. **File upload security** -- Magic number verification, suspicious content scanning, filename sanitization
9. **Production environment validation** -- Required env vars checked at startup with clear error messages
10. **Comprehensive audit logging** -- All auth events logged with user/org context
