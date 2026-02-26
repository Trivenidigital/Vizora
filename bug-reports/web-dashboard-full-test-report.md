# Vizora Web Dashboard — Full Test Report

**Date:** 2026-02-26
**Tester:** Claude Code (automated)
**Branch:** `fix/content-upload-and-thumbnails`
**Environment:** localhost (middleware :3000, web :3001, Docker infra running)
**Test User:** tester@vizora.test (admin, "Test Org", free tier trial)

---

## Module 1: Overview (Dashboard Home)

**Status: PASS**

| Check | Result |
|-------|--------|
| Page loads without errors | PASS |
| Dashboard widgets render | PASS — Total Devices (0), Content Items (0), Playlists (0), System Status (Healthy) |
| Quick Actions section | PASS — Pair Device, Upload Content, Create Playlist, Schedule buttons present |
| Recent Activity | PASS — Empty state "No recent activity yet" |
| Storage Usage | PASS — Shows "0 MB / 5 GB", "0.0% used" |
| Getting Started guide | PASS — 4-step onboarding guide renders |
| Trial banner | PASS — "Free Trial — 30 days remaining" with "View Plans" link |
| User avatar/profile | PASS — Shows "TE" initials, email, name |

**Console Errors:** WebSocket connection failure (expected — realtime service not running)

---

## Module 2: Devices

**Status: PASS**

| Check | Result |
|-------|--------|
| Page loads | PASS |
| Empty state | PASS — "No devices yet" with "Pair Device" button |
| Search box | PASS — Present and functional |
| "Pair New Device" button | PASS |
| Device Groups dropdown | PASS — Shows "Device Groups (0)" |
| Breadcrumb navigation | PASS |
| API calls | PASS — GET /displays, /playlists, /display-groups all return 200 |

---

## Module 3: Content

**Status: PASS**

| Check | Result |
|-------|--------|
| Page loads | PASS |
| Content Library heading | PASS — "Manage your media assets (0 items)" |
| Folders panel | PASS — "All Content" + "No folders yet" |
| Grid/List view toggle | PASS |
| Upload Content button | PASS |
| Search box | PASS |
| Type filters | PASS — All, Image (0), Video (0), Pdf (0), Url (0) |
| Status filter | PASS — All Statuses, Ready, Processing, Error |
| Date filter | PASS — All Time, Last 7/30/90 days |
| Tag filter | PASS |
| Empty state | PASS — "No content yet" with upload button |
| API calls | PASS — GET /content, /folders, /displays, /playlists all return 200 |

---

## Module 4: Templates

**Status: PASS**

| Check | Result |
|-------|--------|
| Page loads | PASS |
| Hero section | PASS — "Design Your Perfect Display" |
| Categories sidebar | PASS |
| Orientation filter | PASS |
| Difficulty filter | PASS |
| Template grid | PASS — "All Templates (0)" with empty state |
| Search functionality | PASS |
| API calls | PASS — GET /template-library, /categories, /featured, /popular all return 200 |

**Note:** The previously reported "Bad Request" error was caused by the BigInt serialization crash on `/auth/me`, which cascaded to make the entire dashboard unreliable. With the BigInt fix, templates work correctly. The frontend properly uses empty string for "All" filters and filters them out before sending to the backend.

---

## Module 5: Widgets

**Status: PASS**

| Check | Result |
|-------|--------|
| Page loads | PASS |
| Widget Gallery heading | PASS |
| Widget types listed | PASS |

---

## Module 6: Layouts

**Status: PASS**

| Check | Result |
|-------|--------|
| Page loads | PASS |
| Layout Presets section | PASS |
| Preset options | PASS — Split Horizontal (2 zones), Split Vertical (2 zones), 2x2 Grid (4 zones), Main+Sidebar (2 zones), L-Shape (3 zones) |

---

## Module 7: Playlists

**Status: PASS**

| Check | Result |
|-------|--------|
| Page loads | PASS |
| Empty state | PASS — "No playlists yet" |
| Create button | PASS |
| Search box | PASS |
| API calls | PASS — GET /playlists returns 200 |

---

## Module 8: Schedules

**Status: PASS**

| Check | Result |
|-------|--------|
| Page loads | PASS |
| Empty state | PASS — "No schedules yet" |
| Create button | PASS |
| API calls | PASS — GET /schedules returns 200 |

---

## Module 9: Analytics

**Status: PASS**

| Check | Result |
|-------|--------|
| Page loads | PASS |
| Summary cards | PASS — Total Devices (0), Content Items (0), Total Size (0 B), System Uptime (0%) |
| Charts render | PASS — Device Uptime Timeline, Content Performance, Device Distribution, Usage Trends, Bandwidth Usage, Top Playlists |

---

## Module 10: Settings

**Status: PASS (with fixes applied)**

| Check | Result |
|-------|--------|
| Settings main page loads | PASS |
| Organization section | PASS — Name, country inputs |
| Appearance/theme section | PASS — Color picker for primary/success/warning/error/info |
| Display Settings section | PASS — Default duration input |
| Notifications section | PASS |
| Billing link | PASS — Links to /dashboard/settings/billing |
| API Keys link | PASS — Links to /dashboard/settings/api-keys |
| Account section | PASS — Password change form |
| Billing sub-page | PASS — Current Plan, Upgrade, Compare Plans, Invoice History |
| API Keys sub-page | PASS — Empty state with usage instructions |
| Password change | PASS (after fix) — POST /auth/change-password works |

---

## Module 11: Global UI Elements

**Status: PASS**

| Check | Result |
|-------|--------|
| Top nav - Notification bell | PASS |
| Top nav - Theme toggle | PASS — Light/Dark buttons present |
| Top nav - User profile | PASS — Shows name, email, avatar initials |
| Sidebar navigation | PASS — All 10 items (Overview through Settings) |
| Sidebar active highlighting | PASS |
| Sidebar version/platform | PASS — "Version 1.0.0", "Platform Vizora" |
| Breadcrumb navigation | PASS — Present on all sub-pages |
| Trial banner | PASS — Shows on all pages with dismiss button |
| Login flow | PASS — Email/password login, cookie-based auth |
| Logout | Not tested via UI (API works) |

**Console Errors (global):**
- WebSocket connection failures (expected — realtime service not running in test)
- No other errors after fixes

---

## Bugs Found & Fixed

### BUG 1: BigInt Serialization Crash (CRITICAL) — FIXED

- **Severity:** CRITICAL
- **Pages Affected:** ALL authenticated pages
- **Error:** `"Do not know how to serialize a BigInt"` (HTTP 500)
- **Steps to Reproduce:** Login → Navigate to any dashboard page
- **Expected:** Page loads with user data
- **Actual:** Multiple 500 errors on `/auth/me`, `/billing/quota`, `/billing/subscription`
- **Root Cause:** Prisma `Organization` model has `storageUsedBytes` (BigInt) and `storageQuotaBytes` (BigInt). The JWT strategy (`jwt.strategy.ts:118`) calls `JSON.stringify()` on user data including the full organization object, which crashes on BigInt values. This breaks ALL authenticated routes because auth validation fails before reaching the handler.
- **Endpoints Affected:** `/auth/me`, `/billing/quota`, `/billing/subscription`, `/organizations/current`, and transitively all protected endpoints
- **Files Modified:**
  1. `middleware/src/main.ts` — Added global `BigInt.prototype.toJSON = function() { return Number(this); }` (line 4-7)
  2. `middleware/src/modules/auth/strategies/jwt.strategy.ts` — Explicitly convert BigInt fields to Number before caching (lines 110-115)

### BUG 2: Missing Change Password Endpoint (CRITICAL) — FIXED

- **Severity:** CRITICAL
- **Page:** Settings → Account → Change Password form
- **Error:** `POST /api/v1/auth/change-password` returned 404
- **Steps to Reproduce:** Go to Settings → scroll to Account → enter current and new passwords → submit
- **Expected:** Password changes successfully
- **Actual:** 404 Not Found
- **Root Cause:** Frontend `web/src/lib/api.ts:332-337` calls `POST /auth/change-password`, but the backend auth controller had no such endpoint
- **Files Created/Modified:**
  1. `middleware/src/modules/auth/dto/change-password.dto.ts` — NEW: DTO with `currentPassword` and `newPassword` validation
  2. `middleware/src/modules/auth/dto/index.ts` — Added export for ChangePasswordDto
  3. `middleware/src/modules/auth/auth.service.ts` — Added `changePassword()` method (validates current password, hashes new, updates DB, invalidates cache)
  4. `middleware/src/modules/auth/auth.controller.ts` — Added `POST change-password` endpoint with JwtAuthGuard

### BUG 3: Unsaved Settings Fields (MEDIUM) — FIXED

- **Severity:** MEDIUM
- **Page:** Settings
- **Steps to Reproduce:** Go to Settings → change Default Duration, Timezone, or Notification preferences → Save → Reload page
- **Expected:** Settings persist
- **Actual (before fix):** Changes are silently lost
- **Root Cause:** The save handler in `web/src/app/dashboard/settings/page.tsx` only saved `organizationName` and `country`. The fields `defaultDuration`, `timezone`, and `notifications` were NOT included in the save payload.
- **Files Modified:**
  1. `web/src/app/dashboard/settings/page.tsx` — Save handler now includes `settings: { defaultDuration, timezone, notifications }` in update payload; load handler reads them from `organization.settings`
  2. `web/src/lib/api.ts` — Added `settings` to Organization interface and AuthUser.organization type; expanded `updateOrganization` parameter type
  3. `middleware/src/modules/organizations/organizations.service.ts` — `update()` now merges incoming settings with existing settings (preserves branding config)

---

## Infrastructure Notes

- **Prisma dist copy issue:** The `postbuild` script in `packages/database/package.json` uses `cp -r src/generated dist/` which fails silently on Windows Git Bash. Required manual copy of Prisma generated files to `dist/generated/prisma/`.
- **Realtime service not tested:** WebSocket connections fail because the realtime gateway (:3002) was not started. This is expected in isolated testing and does not affect dashboard functionality (graceful degradation).
