# Vizora Multi-Tenancy Security Audit Report

**Date:** 2026-02-20
**Branch:** fix/android-high-priority-issues
**Auditor:** Claude Code (automated security audit)
**Scope:** All middleware API endpoints, file storage, WebSocket gateway, database schema

---

## A: Executive Summary

| Metric | Value |
|--------|-------|
| **Data Isolation Status** | **PARTIALLY BREACHED** |
| **Critical Vulnerabilities** | 2 |
| **High Vulnerabilities** | 4 |
| **Medium Vulnerabilities** | 7 |
| **Low Vulnerabilities** | 9 |
| **Immediate Action Required** | **YES** |

**Key Finding:** There is **NO automatic org-isolation mechanism** at the database layer. All multi-tenancy isolation is manual, per-endpoint, via `@CurrentUser('organizationId')` passed to Prisma queries. While most endpoints implement this correctly, the manual approach has produced several critical gaps.

**Architecture Positive:** The JWT strategy fetches `organizationId` from the database (not JWT payload), preventing token forgery. The global `JwtAuthGuard` ensures no endpoint bypasses auth without explicit `@Public()`.

---

## B: Data Model Assessment

### Schema Design: GOOD

All 14 org-specific tables have `organizationId` with database indexes:

| Model | organizationId | Indexed | NOT NULL | Auto-set on Create |
|-------|---------------|---------|----------|-------------------|
| User | YES | YES | YES | YES (via relation) |
| Display | YES | YES | YES | YES |
| DisplayGroup | YES | YES | YES | YES |
| Content | YES | YES | YES | YES |
| Playlist | YES | YES | YES | YES |
| Schedule | YES | YES | YES | YES |
| Tag | YES | YES | YES | YES (unique with name) |
| AuditLog | YES | YES | YES | YES |
| ContentFolder | YES | YES | YES | YES |
| Notification | YES | YES | YES | YES |
| ApiKey | YES | YES | YES | YES |
| BillingTransaction | YES | YES | YES | YES |
| ContentImpression | YES | YES | YES | YES |
| PromotionRedemption | YES | YES | YES | YES |

**Join tables** (PlaylistItem, DisplayGroupMember, ContentTag, DisplayTag) inherit isolation through parent references. No direct `organizationId` needed.

**System tables** (Plan, Promotion, SystemConfig, AdminAuditLog, SystemAnnouncement, IpBlocklist) are correctly platform-wide.

### Missing Schema Elements

| Issue | Severity |
|-------|----------|
| No `storageUsedBytes` column on Organization | MEDIUM |
| No storage quota enforcement mechanism | MEDIUM |
| `Content.isGlobal` flag allows cross-org visibility (by design, but modification not restricted) | HIGH |

---

## C: API Endpoint Audit Results

### Content Module

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/content` | GET | YES | N/A | **PASS** |
| `/content/:id` | GET | YES | YES | **PASS** |
| `/content` | POST | YES (auto-set) | N/A | **PASS** |
| `/content/upload` | POST | YES (auto-set) | N/A | **PASS** |
| `/content/:id` | PATCH | YES | YES | **PASS** |
| `/content/:id` | DELETE | YES | YES | **PASS** |
| `/content/:id/download` | GET | YES | YES | **PASS** |
| `/content/:id/archive` | POST | YES | YES | **PASS** |
| `/content/:id/restore` | POST | YES | YES | **PASS** |
| `/content/:id/replace` | POST | YES | YES | **PASS** |
| `/content/:id/versions` | GET | YES | YES | **PASS** |
| `/content/:id/expiration` | PATCH | YES | YES | **PASS** |
| `/content/:id/expiration` | DELETE | YES | YES | **PASS** |
| `/content/:id/thumbnail` | POST | YES | YES | **PASS** |
| `/content/bulk/*` | POST | YES | YES (count verified) | **PASS** |
| `/device-content/:id/file` | GET | **NO** (@Public) | **OPTIONAL** | **FAIL** |

### Display Module

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/displays` | GET | YES | N/A | **PASS** |
| `/displays/:id` | GET | YES | YES | **PASS** |
| `/displays` | POST | YES (auto-set) | N/A | **PASS** |
| `/displays/:id` | PATCH | YES | YES | **PASS** |
| `/displays/:id` | DELETE | YES | YES | **PASS** |
| `/displays/:id/push-content` | POST | YES | YES | **PASS** |
| `/displays/:id/playlist` | PATCH | YES | YES (both display & playlist) | **PASS** |
| `/devices/pairing/request` | POST | N/A (@Public) | N/A | **PASS** |
| `/devices/pairing/status/:code` | GET | N/A (@Public) | N/A | **PASS** |
| `/devices/pairing/complete` | POST | YES | N/A | **PASS** |

### Playlist Module

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/playlists` | GET | YES | N/A | **PASS** |
| `/playlists/:id` | GET | YES | YES | **PASS** |
| `/playlists` | POST | YES (auto-set) | N/A | **PASS** |
| `/playlists/:id` | PATCH | YES | YES | **PASS** (but see L1) |
| `/playlists/:id/duplicate` | POST | YES | YES | **PASS** |
| `/playlists/:id/reorder` | POST | YES | YES | **PASS** |
| `/playlists/:id/items` | POST | YES | Playlist: YES, Content: **NO** | **FAIL** (L1) |
| `/playlists/:id/items/:itemId` | DELETE | YES | Playlist: YES, Item: **NO** | **FAIL** (L2) |
| `/playlists/:id` | DELETE | YES | YES | **PASS** |

### Schedule Module

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/schedules` | GET | YES | N/A | **PASS** |
| `/schedules/:id` | GET | YES | YES | **PASS** |
| `/schedules` | POST | YES (auto-set) | Refs: **NO** | **FAIL** (L4) |
| `/schedules/:id` | PATCH | YES | YES, Refs: **NO** | **FAIL** (L5) |
| `/schedules/:id` | DELETE | YES | YES | **PASS** |
| `/schedules/:id/duplicate` | POST | YES | YES | **PASS** |
| `/schedules/check-conflicts` | POST | YES | N/A | **PASS** |
| `/schedules/active/:displayId` | GET | **NO** (@Public) | **NO** | **FAIL** (M2) |

### Display Groups Module

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/display-groups` | GET | YES | N/A | **PASS** |
| `/display-groups/:id` | GET | YES | YES | **PASS** |
| `/display-groups` | POST | YES (auto-set) | N/A | **PASS** |
| `/display-groups/:id` | PATCH | YES | YES | **PASS** |
| `/display-groups/:id` | DELETE | YES | YES | **PASS** |
| `/display-groups/:id/displays` | POST | YES (group) | Displays: **NO** | **FAIL** (C1) |
| `/display-groups/:id/displays` | DELETE | YES | YES | **PASS** |

### Template Library Module

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/template-library` | GET | N/A (isGlobal only) | N/A | **PASS** |
| `/template-library/categories` | GET | N/A (isGlobal only) | N/A | **PASS** |
| `/template-library/featured` | GET | N/A (isGlobal only) | N/A | **PASS** |
| `/template-library/:id` | GET | N/A (isGlobal only) | N/A | **PASS** |
| `/template-library/:id/preview` | GET | N/A (isGlobal only) | N/A | **PASS** |
| `/template-library/:id/clone` | POST | YES (destination) | Source: isGlobal only | **PASS** |
| `/template-library` | POST | YES (auto-set) | N/A | **PASS** (but creates global) |
| `/template-library/:id` | PATCH | **NO** | **NO** | **FAIL** (C2) |
| `/template-library/:id` | DELETE | **NO** | **NO** | **FAIL** (C2) |
| `/template-library/:id/featured` | PATCH | **NO** | **NO** | **FAIL** (H3) |

### Organizations Module

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/organizations/:id` | GET | YES (own org) | YES | **PASS** |
| `/organizations/:id` | PATCH | YES (own org) | YES | **PASS** |
| `/organizations` | POST | N/A | N/A | **PASS** (minor: orphan org creation) |

### Users Module

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/users` | GET | YES | N/A | **PASS** |
| `/users/:id` | GET | YES | YES | **PASS** |
| `/users` | POST | YES (auto-set) | N/A | **PASS** |
| `/users/:id` | PATCH | YES | YES | **PASS** |
| `/users/:id` | DELETE | YES | YES | **PASS** |

### Notifications Module

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/notifications` | GET | YES | N/A | **PASS** |
| `/notifications` | POST | YES (auto-set) | N/A | **PASS** (minor: userId not validated) |
| `/notifications/unread-count` | GET | YES | N/A | **PASS** |
| `/notifications/read-all` | POST | YES | N/A | **PASS** |
| `/notifications/:id/read` | PATCH | YES | YES | **PASS** |
| `/notifications/:id/dismiss` | PATCH | YES | YES | **PASS** |

### Billing Module

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/billing/subscription` | GET | YES | N/A | **PASS** |
| `/billing/plans` | GET | YES (country) | N/A | **PASS** |
| `/billing/checkout` | POST | YES | N/A | **PASS** |
| `/billing/upgrade` | POST | YES | N/A | **PASS** |
| `/billing/downgrade` | POST | YES | N/A | **PASS** |
| `/billing/cancel` | POST | YES | N/A | **PASS** |
| `/billing/reactivate` | POST | YES | N/A | **PASS** |
| `/billing/portal` | GET | YES | N/A | **PASS** |
| `/billing/invoices` | GET | YES | N/A | **PASS** |
| `/billing/quota` | GET | YES | N/A | **PASS** |
| `/webhooks/stripe` | POST | @Public | Signature verification (provider) | **PASS** (caveat) |
| `/webhooks/razorpay` | POST | @Public | Signature verification (provider) | **PASS** (caveat) |

### Other Modules

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/api-keys` (all) | ALL | YES | YES | **PASS** |
| `/audit-logs` | GET | YES | N/A | **PASS** |
| `/analytics/*` (all 11) | GET | YES | YES (single-resource) | **PASS** |
| `/folders/*` (all) | ALL | YES | YES (incl. parent/content) | **PASS** |
| `/health/*` | GET | @Public | N/A (no tenant data) | **PASS** |
| `/admin/*` (all) | ALL | SuperAdmin guard | Cross-org by design | **PASS** |
| `/internal/metrics` | GET | @Public | N/A (aggregate only) | **PASS** (minor) |

### Layouts/Widgets/Templates (Content sub-controllers)

| Endpoint | Method | Org Filter? | Ownership Check? | Status |
|----------|--------|-------------|------------------|--------|
| `/content/layouts/*` | ALL | YES | YES | **PASS** |
| `/content/widgets/*` | ALL | YES | YES | **PASS** |
| `/content/templates/*` | ALL | YES | YES | **PASS** |

---

## D: Attack Vector Results

### 1. IDOR (Insecure Direct Object Reference)

**Test:** Can User B (Org 2) access User A's (Org 1) content by ID?

**Result: PASS** for authenticated endpoints. All `findOne` methods use `where: { id, organizationId }`. Returns 404 for non-matching org.

**Result: FAIL** for `GET /api/v1/device-content/:id/file`. This `@Public()` endpoint serves any content by CUID without authentication. **Severity: HIGH**

### 2. List Endpoint Leakage

**Result: PASS.** All list endpoints (GET /content, /displays, /playlists, etc.) filter by `organizationId` from the authenticated user's JWT. Different orgs see completely different data.

### 3. Org ID Injection

**Result: PASS.** All create operations extract `organizationId` from `@CurrentUser('organizationId')` (server-side, from database lookup), never from request body. An attacker cannot inject a different org ID.

### 4. File Path Traversal

**Result: FAIL.**
- `GET /uploads/{filename}` serves files without ANY authentication (static file route)
- `GET /static/thumbnails/{contentId}.ext` serves thumbnails without auth
- MinIO files use org-prefixed paths (`{orgId}/{hash}-{filename}`) but the device-content endpoint bypasses org check
- **Severity: HIGH**

### 5. Device Cross-Access

**Result: PASS** for authenticated endpoints. Display CRUD uses `organizationId` consistently.

**Result: FAIL** for display groups: `addDisplays()` doesn't verify display IDs belong to the same org. **Severity: CRITICAL**

### 6. Playlist/Schedule Cross-Access

**Result: PARTIAL FAIL.**
- Playlist CRUD: PASS
- Playlist `addItem`: FAIL (contentId not verified against org) **Severity: LOW**
- Schedule `create/update`: FAIL (displayId, playlistId, displayGroupId not verified against org) **Severity: LOW**
- Schedule `findActiveSchedules`: FAIL (no org filter on device endpoint) **Severity: MEDIUM**

### 7. WebSocket Isolation

**Result: PASS.** WebSocket rooms are org-scoped (`org:{orgId}`). Room join handlers verify `client.data.organizationId` (from verified JWT) matches the requested room. No broadcast-to-all exists.

**Minor gap:** JWT orgId not cross-checked against current DB orgId on connection. Stale JWT after org transfer could persist for up to 365 days. **Severity: MEDIUM**

---

## E: File Storage Assessment

| Aspect | Status | Details |
|--------|--------|---------|
| **Storage isolation** | **NOT ISOLATED** (local), **PARTIALLY ISOLATED** (MinIO) | MinIO uses org-prefixed paths (`{orgId}/{hash}-{filename}`), but local fallback uses flat `uploads/` directory |
| **File access control** | **NOT ENFORCED** | Device-content endpoint is @Public with optional auth. Static routes bypass all auth. |
| **Direct URL access** | **ACCESSIBLE** | `/uploads/{filename}` and `/static/thumbnails/{id}.ext` serve files to anyone |
| **Thumbnail isolation** | **NOT ISOLATED** | Flat directory `static/thumbnails/`, no org prefix, no auth |

### Specific Vulnerabilities

1. **Static file routes bypass all NestJS guards** (`main.ts` lines 42-52): `useStaticAssets` for `/static/` and `/uploads/` serve files before the global prefix, with no auth middleware.

2. **Device content endpoint** (`device-content.controller.ts`): `@Public()` + `findById(id)` (no org filter) + optional token verification = any content accessible by CUID.

3. **Local storage fallback** (`content.controller.ts` `saveFileLocally`): Files saved to `uploads/{hash}-{filename}` with no org directory. Combined with static serving = cross-org file access.

4. **Thumbnails** (`thumbnail.service.ts`): Stored at `static/thumbnails/{contentId}.{ext}`. Public, flat, no org prefix. CUIDs are partially predictable (time-sortable).

5. **MinIO object keys** include org prefix (`{orgId}/...`) but there are no MinIO bucket policies enforcing this. Single service account has full bucket access.

---

## F: Storage Quota Status

| Aspect | Status |
|--------|--------|
| **Current quota enforcement** | **DOES NOT EXIST** |
| **Current storage tracking** | **DOES NOT EXIST** |
| **Quota definition** | EXISTS (Plan.storageQuotaMb, default 5000) |
| **Usage column on Organization** | **MISSING** |
| **Upload size check against quota** | **MISSING** |
| **Dashboard storage indicator** | **MISSING** |

The `Plan` model defines `storageQuotaMb` (default 5000 = ~5GB), but:
- Organization has no `storageUsedBytes` or equivalent column
- No code calculates or tracks storage usage per org
- No upload endpoint checks against any quota
- No API endpoint returns storage usage information
- The billing `getQuota()` endpoint returns screen quota info but not storage quota

---

## G: WebSocket Isolation

| Aspect | Status |
|--------|--------|
| **Room/channel scoping** | **ORG-SCOPED** (`org:{orgId}` and `device:{deviceId}`) |
| **Message leakage possible?** | **NO** (under normal operation) |
| **Connection authentication** | Device JWT verified (HS256, dedicated secret, revocation check) |
| **Room join authorization** | Verified against `client.data.organizationId` |
| **Global broadcasts** | **NONE** (all emissions use `.to()`) |
| **Dashboard WebSocket** | Currently non-functional (device JWT required, dashboard has user JWT) |

**One gap:** Device JWT `organizationId` is not cross-checked against the database on connection. If a device is transferred between orgs, the old JWT remains valid for up to 365 days, allowing the device to stay in the wrong org's room.

---

## H: Prioritized Fix List

### CRITICAL (Fix before any production use)

| # | ID | Vulnerability | Location | Impact |
|---|-----|--------------|----------|--------|
| 1 | C1 | **Display Groups `addDisplays()` allows cross-org display injection** | `display-groups.service.ts` `addDisplays()` | Attacker can link any org's displays to their group, leaking display details and potentially pushing unauthorized content |
| 2 | C2 | **Template Library `update/delete` have no org ownership check** | `template-library.service.ts` `updateTemplate()`, `deleteTemplate()` | Any org admin can modify or delete ANY global template, affecting all organizations |

### HIGH (Fix immediately after critical)

| # | ID | Vulnerability | Location | Impact |
|---|-----|--------------|----------|--------|
| 3 | H1 | **Device content endpoint serves files without authentication** | `device-content.controller.ts` `serveFile()` | Any content accessible by CUID without auth. CUIDs can leak via logs, referrers, browser devtools |
| 4 | H2 | **Static `/uploads/` route bypasses all authentication** | `main.ts` lines 48-52 | Any locally-stored file accessible to anyone with the URL |
| 5 | H3 | **Static `/static/` route serves thumbnails without auth** | `main.ts` lines 42-45 | All thumbnails publicly accessible. Content IDs partially predictable |
| 6 | H4 | **Template Library `setFeatured()` has no org ownership check** | `template-library.service.ts` `setFeatured()` | Any org admin can change featured status of any global template |

### MEDIUM (Fix soon)

| # | ID | Vulnerability | Location | Impact |
|---|-----|--------------|----------|--------|
| 7 | M1 | **`findActiveSchedules` has no org filter** | `schedules.service.ts` `findActiveSchedules()` | Device from Org A can request schedules for Org B's display |
| 8 | M2 | **WebSocket JWT orgId not cross-checked against DB** | `device.gateway.ts` `handleConnection()` | Stale JWT after org transfer persists up to 365 days |
| 9 | M3 | **Local storage fallback uses flat directory (no org prefix)** | `content.controller.ts` `saveFileLocally()` | All orgs' local files in same directory, accessible via static route |
| 10 | M4 | **No automatic org-scoping at database layer** | `database.service.ts` | Manual enforcement is fragile; any developer oversight = vulnerability |
| 11 | M5 | **Prometheus metrics endpoint public** | `metrics.controller.ts` | Exposes aggregate operational metrics without authentication |
| 12 | M6 | **Notification userId not validated against org** | `notifications.service.ts` `create()` | Admin can associate notification with user from different org |
| 13 | M7 | **Webhook signature verification status unconfirmed** | `webhooks.controller.ts` / payment providers | If signatures not verified, forged webhooks could modify any org's subscription |

### LOW (Address in next sprint)

| # | ID | Vulnerability | Location | Impact |
|---|-----|--------------|----------|--------|
| 14 | L1 | **Playlist `addItem` doesn't verify contentId org** | `playlists.service.ts` `addItem()` | Cross-org content reference in playlist |
| 15 | L2 | **Playlist `removeItem` doesn't verify item belongs to playlist** | `playlists.service.ts` `removeItem()` | Could delete items from other playlists |
| 16 | L3 | **Playlist `update` with items doesn't verify contentIds** | `playlists.service.ts` `update()` | Same as L1 |
| 17 | L4 | **Schedule `create` doesn't verify displayId/playlistId/groupId org** | `schedules.service.ts` `create()` | Cross-org reference in schedule |
| 18 | L5 | **Schedule `update` doesn't verify referenced entity orgs** | `schedules.service.ts` `update()` | Same as L4 |
| 19 | L6 | **Presigned URL expiry has no upper bound** | `content.controller.ts` `getDownloadUrl()` | User could request very long-lived download URLs |
| 20 | L7 | **Internal push endpoints don't redundantly check org** | `app.controller.ts` (realtime) | Relies on middleware for org validation |
| 21 | L8 | **SuperAdminGuard has property name mismatch (userId vs id)** | `super-admin.guard.ts` line 10 | Bug: admin panel inaccessible (fails closed, not a security risk) |
| 22 | L9 | **Template Library creates global templates from any org** | `template-library.service.ts` `createTemplateForOrg()` | Any org admin can create templates visible to all orgs |

### STORAGE QUOTA (New feature implementation)

| # | ID | Requirement | Priority |
|---|-----|-------------|----------|
| 23 | Q1 | Add `storageUsedBytes` column to Organization table | MEDIUM |
| 24 | Q2 | Enforce 5GB (configurable per plan) upload quota | MEDIUM |
| 25 | Q3 | Track storage usage on upload/delete | MEDIUM |
| 26 | Q4 | Add storage usage API endpoint | MEDIUM |
| 27 | Q5 | Add storage usage indicator in dashboard | LOW |
| 28 | Q6 | Handle race conditions on concurrent uploads | LOW |
| 29 | Q7 | Backfill current storage usage per org | MEDIUM |

---

## Modules Passing Full Audit

These modules have **correct and comprehensive** org isolation:

| Module | Notes |
|--------|-------|
| Content CRUD | All endpoints properly scoped |
| Display CRUD | All endpoints properly scoped |
| User CRUD | All endpoints properly scoped |
| Organization CRUD | Properly scoped to own org |
| Notification CRUD | All queries include orgId |
| Billing | All operations scoped to own org |
| API Keys | All CRUD scoped, revoke uses compound where |
| Audit Logs | Properly filtered by orgId |
| Analytics (all 11 endpoints) | All scoped, single-resource lookups verified |
| Folders | Exceptional: validates parent, child, and content ownership |
| Layouts/Widgets/Templates (content sub-controllers) | All properly scoped |
| Admin | Cross-org by design, properly guarded by SuperAdminGuard |

---

## Architectural Recommendations

1. **Immediate:** Fix the 2 CRITICAL and 4 HIGH severity issues
2. **Short-term:** Add Prisma middleware (`$use()`) that auto-injects `organizationId` on all queries when request-scoped orgId is available
3. **Medium-term:** Add integration tests for every endpoint that verify cross-org access is blocked (e.g., "User in OrgA tries to access OrgB's resources")
4. **Long-term:** Consider PostgreSQL Row-Level Security (RLS) policies for defense-in-depth

---

**STOP. This report is for review. No fixes will be applied until the user approves Phase 2.**
