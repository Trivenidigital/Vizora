# Integration Bug Report

## Cross-Module Integration Testing Results

**Date**: 2026-02-25
**Branch**: `fix/content-upload-and-thumbnails`

---

## Integration Test Cases

| # | Integration Point | Test Area | Status |
|---|---|---|---|
| 1 | Auth → All Modules | JWT payload shape consistency | **ISSUE** |
| 2 | Content → Storage → Billing | Upload/delete/quota flow | **ISSUES** |
| 3 | Frontend API Client ↔ Backend API | Type contracts | **ISSUES** |
| 4 | Realtime ↔ Middleware | Device communication | PASS |
| 5 | Frontend ↔ Realtime | WebSocket integration | **ISSUE** |
| 6 | Database Schema ↔ Application Code | BigInt handling | **ISSUE** |
| 7 | Build Pipeline | All 3 services compile | **1 FAIL** |

---

## Build Verification

| Service | Build Command | Result |
|---------|---------------|--------|
| Middleware | `npx nx build @vizora/middleware` | **PASS** |
| Realtime | `npx nx build @vizora/realtime` | **PASS** |
| Web | `npx nx build @vizora/web` | **FAIL** |

Web build fails with TypeScript error — see BUG-INT-WEB-BUILD below.

---

## Cross-Module Bugs

### BUG-INT-001: BigInt Serialization Crash on Organization Endpoints (HIGH)

**Severity**: HIGH — Runtime crash
**Affected Services**: Middleware → Frontend
**File**: `middleware/src/modules/organizations/organizations.service.ts:46`

**Description**: `findOne()` returns raw Prisma model with `storageUsedBytes` and `storageQuotaBytes` as `BigInt`. There is no global `BigInt.prototype.toJSON` override, no conversion in the service, and the `ResponseEnvelopeInterceptor` doesn't handle BigInt. Any call to `GET /organizations/current` or `GET /organizations/:id` throws:

```
TypeError: Do not know how to serialize a BigInt
```

The JWT strategy correctly converts these with `Number()`, but the organizations service does not.

**Impact**: Organizations API endpoints crash. Any frontend page fetching org details fails.

**Suggested Fix**: Add BigInt→Number conversion in organizations.service.ts:
```typescript
return {
  ...org,
  storageUsedBytes: Number(org.storageUsedBytes),
  storageQuotaBytes: Number(org.storageQuotaBytes),
};
```

---

### BUG-INT-002: Frontend Cannot Pass JWT to WebSocket Gateway (HIGH)

**Severity**: HIGH — WebSocket connections silently fail
**Affected Services**: Web → Realtime
**Files**: `web/src/lib/hooks/useSocket.ts:77`, `realtime/src/gateways/device.gateway.ts:272`

**Description**: Middleware stores JWTs in httpOnly cookies (by design, for XSS protection). Frontend's `useSocket` hook tries to pass `auth: { token }` to Socket.IO, but JavaScript cannot read httpOnly cookies. Gateway requires `client.handshake.auth.token` and rejects connections without it.

**Impact**: Dashboard real-time features (device status, live playlist changes, notifications) don't work. Device-side connections using direct JWT tokens are unaffected.

**Suggested Fix**:
1. Use Socket.IO cookie transport (httpOnly cookie auto-sent with WebSocket upgrade)
2. Or create a short-lived WebSocket token endpoint

---

### BUG-INT-003: Content Deletion Orphans MinIO Objects (MEDIUM)

**Severity**: MEDIUM
**Affected Services**: Middleware (Content → Storage)
**File**: `middleware/src/modules/content/content.service.ts:181`

**Description**: `remove()` deletes the DB record and decrements `storageUsedBytes`, but never calls `storageService.deleteFile()`. Files accumulate as orphans in S3/MinIO, increasing storage costs.

---

### BUG-INT-004: Bulk Delete Does Not Decrement Storage Quota (MEDIUM)

**Severity**: MEDIUM
**Affected Services**: Middleware (Content → Billing)
**File**: `middleware/src/modules/content/content.service.ts:455`

**Description**: `bulkDelete()` calls `db.content.deleteMany()` without calling `storageQuotaService.decrementUsage()`. Quota becomes permanently inflated.

---

### BUG-INT-005: Plan Upgrade Does Not Update Storage Quota (MEDIUM)

**Severity**: MEDIUM
**Affected Services**: Billing → Storage
**Files**: `middleware/src/modules/billing/constants/plans.ts`, `billing.service.ts`

**Description**: `PLAN_TIERS` describes storage in text ("1 GB", "25 GB") but has no `storageQuotaMb` field. Plan upgrades don't update `Organization.storageQuotaBytes`.

---

### BUG-INT-006: Auth JWT Strategy Omits firstName/lastName (MEDIUM)

**Severity**: MEDIUM
**Affected Services**: Auth → Frontend
**Files**: `middleware/src/modules/auth/strategies/jwt.strategy.ts:127-133`, `web/src/lib/api.ts:40-52`

**Description**: JWT strategy returns `{ id, email, organizationId, role, organization }` without `firstName` or `lastName`. Frontend `AuthUser` type expects them. Dashboard user name always shows undefined.

---

### BUG-INT-WEB-BUILD: Web Build Fails — TypeScript Error (CRITICAL)

**Severity**: CRITICAL — **Deployment Blocker**
**File**: `web/src/app/dashboard/settings/page.tsx:39`

**Error**: `Property 'settings' does not exist on type '{ name: string; subscriptionTier: string; country?: string | undefined; }'`

**Description**: The organization type from `getCurrentUser()` doesn't include a `settings` field, but the settings page tries to access `user.organization?.settings`. Build fails with TypeScript strict mode.

---

### BUG-INT-007: Duplicate Types Between Services (LOW)

**Severity**: LOW
**Affected Services**: Realtime ↔ Middleware

**Description**: Realtime defines its own `Playlist`, `PlaylistContentItem` independently from middleware. `content.thumbnailUrl` vs `content.thumbnail`. Manual mapping creates maintenance risk.

---

### BUG-INT-008: Dead WebSocket Event Handlers (LOW)

**Severity**: LOW
**File**: `web/src/lib/hooks/useRealtimeEvents.ts:285,294`

**Description**: Frontend listens for `health:alert` and `schedule:executed` events that the gateway never emits.

---

## Data Flow Analysis

### Upload Flow: CORRECT
```
Frontend → Content Controller → FileValidation → StorageService → MinIO
                                                → StorageQuotaService (check + increment)
                                                → ThumbnailService (fire-and-forget)
```

### Delete Flow: BROKEN (orphaned files + quota inflation)
```
Frontend → Content Controller → ContentService.remove()
                                 → DB record deleted ✓
                                 → Quota decremented ✓
                                 → MinIO file deleted ✗ ← MISSING
```

### Billing Webhook Flow: BROKEN (events dropped)
```
Stripe/Razorpay → Webhook Controller → BillingService.handleWebhookEvent()
                                        → event.type === undefined (raw body, not parsed)
                                        → Falls to default → SILENTLY DROPPED
```

### WebSocket Auth Flow: BROKEN (for dashboard clients)
```
Dashboard → useSocket hook → Socket.IO connect with auth.token
                              → Token is undefined (httpOnly cookie inaccessible)
                              → Gateway rejects connection
```

---

## Performance Concerns

1. **No Prisma connection pool config**: Default pool settings may exhaust PostgreSQL connections under load
2. **Redis single-instance**: No Sentinel/Cluster. Single point of failure
3. **MinIO single-instance**: No replication. File storage has no redundancy

---

## Deployment Blockers Summary

| Priority | Issue | Category |
|----------|-------|----------|
| **CRITICAL** | Web build TypeScript error (settings/page.tsx) | Build |
| **CRITICAL** | Webhook signature verification missing | Billing |
| **HIGH** | BigInt serialization crash (organizations API) | Runtime |
| **HIGH** | WebSocket auth gap (dashboard real-time) | Integration |
| **HIGH** | JWT strategy returns NaN for storage fields | Auth |
| **HIGH** | apiClient.getQuotaUsage/setAuthenticated missing | Frontend |

---

## Overall Production-Readiness: **NOT READY**

There are 2 critical and 4 high-severity issues that must be resolved before deployment. The billing webhook processing is broken (events silently dropped), the web application cannot build, organization API endpoints crash on BigInt serialization, and dashboard real-time features don't work due to WebSocket auth mismatch.
