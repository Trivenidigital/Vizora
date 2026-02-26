# Vizora Web Dashboard — Bug Summary

**Date:** 2026-02-26
**Branch:** `fix/content-upload-and-thumbnails`
**Total Bugs Found:** 3

---

## Severity Counts

| Severity | Found | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 2 | 2 | 0 |
| MEDIUM | 1 | 1 | 0 |
| **Total** | **3** | **3** | **0** |

---

## Top Issues (Ranked by Impact)

### 1. BigInt Serialization Crash [CRITICAL] — FIXED
- **Impact:** ALL authenticated pages broken (500 errors on every protected endpoint)
- **Root Cause:** `JSON.stringify()` on Prisma BigInt fields (`storageUsedBytes`, `storageQuotaBytes`) in JWT strategy crashes with "Do not know how to serialize a BigInt"
- **Fix:** Global `BigInt.prototype.toJSON` in `middleware/src/main.ts` + explicit Number conversion in `jwt.strategy.ts`

### 2. Missing Change Password Endpoint [CRITICAL] — FIXED
- **Impact:** Settings > Account > Change Password form returned 404
- **Root Cause:** Frontend calls `POST /auth/change-password` but the backend had no such endpoint
- **Fix:** Created `change-password.dto.ts`, added `changePassword()` to `auth.service.ts` and controller endpoint

### 3. Unsaved Settings Fields [MEDIUM] — FIXED
- **Impact:** Default Duration, Timezone, and Email Notifications silently lost on save
- **Root Cause:** Save handler only persisted `organizationName` and `country`, ignoring other fields
- **Fix:** Save `defaultDuration`, `timezone`, `notifications` to Organization's `settings` JSON column; load them back on page mount; backend merges settings to preserve branding config

---

## Module Health Ranking

| Rank | Module | Status | Notes |
|------|--------|--------|-------|
| 1 | Overview | Healthy | All widgets render correctly |
| 2 | Devices | Healthy | Empty state, search, pairing all work |
| 3 | Content | Healthy | Upload, filters, grid/list toggle all work |
| 4 | Templates | Healthy | Was broken by BigInt bug (now fixed) |
| 5 | Widgets | Healthy | Gallery renders |
| 6 | Layouts | Healthy | All preset options render |
| 7 | Playlists | Healthy | CRUD and search work |
| 8 | Schedules | Healthy | CRUD works |
| 9 | Analytics | Healthy | All charts and cards render |
| 10 | Global UI | Healthy | Nav, breadcrumbs, theme toggle, trial banner |
| 11 | Settings | Healthy | All fields now persist correctly |

---

## Systemic Patterns

1. **BigInt serialization**: Prisma BigInt fields require explicit handling before `JSON.stringify()`. Any new BigInt field will need the same treatment. The global `toJSON` override provides a safety net but explicit conversion is preferred.

2. **Frontend-backend endpoint parity**: The frontend had a `changePassword()` API call with no corresponding backend endpoint. Frontend and backend should be developed in lockstep for auth flows.

3. **JSON settings column**: Organization `settings` is a JSONB column that holds branding, display preferences, timezone, and notification settings. Updates must merge (not overwrite) to avoid losing sibling keys.

---

## Infrastructure Notes

- WebSocket connection failures are expected (realtime service not started during test)
- Prisma `postbuild` script (`cp -r`) fails silently on Windows Git Bash — requires manual copy
- No other console errors observed after fixes
