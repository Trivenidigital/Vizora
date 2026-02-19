# Web Dashboard - Bug Summary

**Date**: 2026-02-18 | **Branch**: `feat/phase-3-major-features`

---

## Severity Counts

| Severity | Found | Fixed | Open |
|----------|-------|-------|------|
| Critical | 2 | 2 | 0 |
| High | 1 | 1 | 0 |
| Medium | 1 | 0 | 1 |
| **Total** | **4** | **3** | **1** |

---

## Top Issues (Ranked by Impact)

### 1. Global ValidationPipe blocks all paginated queries [CRITICAL] [FIXED]
**Impact**: Templates page completely broken (400 error). Notifications fail silently on every page load. Any endpoint using `@IsInt()` on query params affected.
**Root cause**: `enableImplicitConversion: false` in `middleware/src/main.ts:90`. Query strings are always strings in HTTP; this setting prevented `class-transformer` from converting them to numbers, causing `@IsInt()` validation to reject `"1"` (string) instead of `1` (number).
**Fix**: One-line change - set `enableImplicitConversion: true`.

### 2. Layouts page crashes with React render error [CRITICAL] [FIXED]
**Impact**: Entire Layouts page unusable - shows React error boundary.
**Root cause**: `preset.zones` from API is `[{id, name, gridArea}]` but rendered directly in JSX as `{preset.zones}`. React cannot render object arrays as children.
**Fix**: Three locations in `web/src/app/dashboard/layouts/page.tsx` changed to render `preset.zones.length` instead.

### 3. CustomizationProvider sends request to /organizations/undefined [HIGH] [FIXED]
**Impact**: 403 error on every page load. Branding/theming never loads. Console noise on every navigation.
**Root cause**: Provider reads `org.id` from raw API response but doesn't unwrap the `{success, data}` response envelope, so `org` is `{success: true, data: {id: ...}}` and `org.id` is `undefined`.
**Fix**: Unwrap envelope in `CustomizationProvider.tsx` for both org and branding responses.

### 4. Theme toggle visual feedback uncertain [MEDIUM] [OPEN]
**Impact**: Low - cosmetic. Toggle button exists but theme change may not apply visually.
**Status**: Could not reliably reproduce. Needs manual verification.

---

## Module Health Ranking

| Rank | Module | Status | Notes |
|------|--------|--------|-------|
| 1 | Devices | Healthy | No issues |
| 2 | Content | Healthy | No issues |
| 3 | Playlists | Healthy | No issues |
| 4 | Schedules | Healthy | No issues |
| 5 | Analytics | Healthy | No issues |
| 6 | Widgets | Healthy | No issues |
| 7 | Settings | Healthy | No issues |
| 8 | Overview | Fixed | Was affected by notifications 400 + branding 403 |
| 9 | Templates | Fixed | Was completely broken (400 Bad Request) |
| 10 | Layouts | Fixed | Was crashing (React render error) |
| 11 | Global UI | Minor issue | Theme toggle needs manual check |

---

## Systemic Patterns

1. **Response envelope inconsistency**: The middleware wraps all responses in `{success, data}` via `ResponseEnvelopeInterceptor`, but some frontend code (CustomizationProvider) uses raw `fetch()` instead of the API client and doesn't unwrap the envelope. **Recommendation**: Audit all raw `fetch()` calls in the frontend for envelope unwrapping.

2. **Type coercion gap**: The `enableImplicitConversion: false` setting was dangerous because HTTP query params are always strings. Any DTO using `@IsInt()`, `@IsNumber()`, `@IsBoolean()` on query params would silently fail. **Recommendation**: Keep `enableImplicitConversion: true` and rely on explicit `@Type()` decorators only where needed.

3. **API response shape assumptions**: The Layouts page assumed `preset.zones` was a number (count) but the API returns the full zone objects. **Recommendation**: Add TypeScript interfaces for API response shapes and use them consistently.
