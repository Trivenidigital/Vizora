# Bounded Playlist Fan-out Pass 35

## Goal

Reduce middleware/realtime pressure when a playlist assigned to many displays is
updated by bounding the number of simultaneous realtime push requests.

## New primitives introduced

None. This pass only adds a small private concurrency helper inside the existing
`PlaylistsService` notification path. No schema, route, module, queue, env var,
response envelope, realtime gateway contract, notification substrate, MCP tool,
Hermes skill, provider spend path, or production process changes.

## Hermes-first analysis

Not applicable. This pass does not add or modify business agents, MCP tools,
Hermes skills, AI/provider calls, or spend paths.

## Drift check

Evidence before scope:

- `middleware/src/modules/playlists/playlists.service.ts` already has the native
  update path and circuit-breaker wrapped realtime POST in
  `notifyDisplaysOfPlaylistUpdate()`.
- That method currently calls `Promise.allSettled(displays.map(...))`, so a
  playlist assigned to hundreds of displays can enqueue hundreds of simultaneous
  HTTP requests.
- Existing tests in `middleware/src/modules/playlists/playlists.service.spec.ts`
  cover dispatch count, no-display skip, missing secret skip, and fallback
  behavior, but not fan-out concurrency.

## Plan

- [x] Add a focused Jest test that makes the existing unbounded fan-out fail by
  holding notifier promises open and asserting active circuit-breaker calls never
  exceed the configured limit.
- [x] Implement a private bounded runner in `PlaylistsService` and route display
  notifications through it.
- [x] Keep the existing fire-and-forget behavior: playlist updates must still
  return without surfacing realtime delivery failures to the caller.
- [x] Preserve the existing circuit-breaker call, internal auth header, and
  realtime `/api/push/playlist` payload shape.
- [x] Run multi-vector subagent review before broader verification.
- [x] Run focused middleware playlist tests, middleware typecheck, changed-file
  lint, security scan, and broader middleware verification.
- [ ] Open PR, wait for CI, merge only if green, then re-check the production
  deploy gate without modifying prod state.

## Test Strategy

Focused red/green:

```powershell
pnpm --filter @vizora/middleware test -- --runInBand --runTestsByPath src/modules/playlists/playlists.service.spec.ts
```

Broader verification:

```powershell
pnpm --filter @vizora/middleware exec tsc --noEmit --pretty false
$env:ESLINT_USE_FLAT_CONFIG='false'; npx eslint middleware/src/modules/playlists/playlists.service.ts middleware/src/modules/playlists/playlists.service.spec.ts
pnpm security:no-hardcoded-jwts
git diff --check
pnpm --filter @vizora/middleware test -- --runInBand
npx nx build @vizora/middleware --skip-nx-cache
```

## Review Vectors

- Performance/correctness: concurrency limit is real, all displays are attempted,
  and failures do not stall later displays.
- Architecture/security: uses the existing internal realtime route,
  circuit-breaker path, auth secret, and tenant-neutral display query behavior
  without adding parallel infrastructure.
