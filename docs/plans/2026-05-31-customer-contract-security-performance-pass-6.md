# Customer Contract, Security, and Performance Pass 6 Plan

**Goal:** Fix the next small, high-impact repo-side issues that a customer would feel directly after PR #128: broken billing redirects, SSR API prefetch drift, false-success device pushes, SSRF redirect gaps, and ineffective authenticated media preloading.

**New primitives introduced:** none. Reuse the existing `ApiClient`, Next server fetch helper, middleware display push path, realtime push response contract, shared SSRF guard, and display Cache API preload path.

**Hermes-first analysis:** not applicable. This pass does not add business-agent behavior, MCP tools, Hermes skills, AI provider calls, or spend paths.

## Selected Fix Bundle

1. **Billing checkout/portal response normalization**
   - Backend returns `{ checkoutUrl }` and `{ portalUrl }`; web types/pages expect `{ url }`.
   - Fix in `web/src/lib/api/billing.ts` by normalizing backend-shaped responses at the API boundary.
   - Tests: add API-client tests that fail on backend-shaped responses before the normalization.

2. **Server-side dashboard/admin prefetch auth and envelope handling**
   - `serverFetch` reads a non-existent `token` cookie and returns raw envelopes.
   - Fix in `web/src/lib/server-api.ts` by reading `vizora_auth_token`, forwarding it as both cookie and bearer auth, and unwrapping `{ success, data }`.
   - Tests: mock `next/headers` and `fetch` to verify cookie forwarding, envelope unwrap, and error parsing.

3. **Display push-content false success**
   - Middleware posts to realtime `/api/push/content` but ignores `success: false` responses.
   - Fix in `middleware/src/modules/displays/displays.service.ts` by checking the realtime response and surfacing delivery failure as a 503.
   - Tests: add `DisplaysService.pushContent` coverage for success, realtime `success:false`, and missing internal secret.

4. **RSS/thumbnail SSRF redirect hardening**
   - RSS preview and thumbnail URL fetches validate the original URL but fetch with redirects enabled.
   - Fix by using the shared SSRF guard and `redirect: 'manual'`; reject 3xx redirects in this slice rather than implementing recursive redirect following.
   - Tests: RSS preview rejects redirect responses; thumbnail URL generation rejects redirect responses after initial validation.

5. **Authenticated display media preload**
   - Display preloads unauthenticated raw content URLs, while render-time playback appends the device token later.
   - Fix in `web/src/app/display/DisplayClient.tsx` by preloading authenticated URLs with the same token path used by playback.
   - Tests: display client/cache tests verify preloaded URLs include the device token for `/device-content/...` paths.

## Deferred Larger Work

- Direct-to-storage multipart uploads and background media processing.
- Versioned signed media URLs/CDN cache design.
- Full schedule conflict confirmation UX.
- CSRF middleware mounting across all mutating routes.
- API-key-authenticated customer API surface or removal of dashboard API-key docs.

## Verification Plan

- Focused red/green tests for each changed surface.
- Multi-subagent code review before broader tests.
- Broader affected suites:
  - `pnpm --filter @vizora/web test -- --runInBand --testPathPattern="billing|server-api|DisplayClient|useBrowserCache"`
  - `pnpm --filter @vizora/middleware test -- --runInBand --testPathPattern="displays.service|widgets.controller|thumbnail.service"`
  - `pnpm --filter @vizora/web exec tsc --noEmit --pretty false`
  - `pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false`
  - `npx nx build @vizora/web`
  - `npx nx build @vizora/middleware`
  - `git diff --check origin/main...HEAD`

## Deploy Gate

Do not deploy this pass unless `/opt/vizora/app` is reconciled. The current production checkout is dirty and diverged from `origin/main`; source pull/restart/deploy would risk overwriting prod-local work.
