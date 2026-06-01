# Realtime Widget Secret Boundary Pass 30

**Date:** 2026-06-01

**Branch:** `feat/customer-readiness-pass-30`

**Goal:** Prevent generic API widget secrets from crossing the realtime/device delivery boundary while preserving display-compatible widget playback metadata.

**Current evidence:** Pass 29 redacts generic API widget headers from middleware HTTP content responses, but realtime still builds device payloads from raw Prisma `content.metadata` in:
- `realtime/src/services/playlist.service.ts`
- `realtime/src/gateways/device.gateway.ts`

That means saved `metadata.widgetConfig` secrets can still be sent to display clients through cached playlists, initial state, pending playlist replay, or admin-triggered playlist pushes.

**New primitives introduced:** one realtime-local payload sanitizer helper for device-bound content metadata. No new database model, migration, route, queue, realtime room model, MCP tool, Hermes skill, provider spend path, or production process.

## Hermes-First Analysis

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Realtime device payload sanitization | None applicable in official bundled catalog; available Hermes skills are agent workflow/tooling skills, not Vizora runtime sanitizers. | Build inside existing realtime service path. |
| Secret redaction for content metadata | None applicable; this is an in-process payload projection concern and must stay in Vizora auth/tenant boundary. | Build from scratch with focused tests. |

Awesome Hermes ecosystem check: searched current `awesome-hermes-agent` listings; no reusable runtime payload sanitizer exists or applies to NestJS/Socket.IO device payload projection, so this remains native Vizora code.

## Drift Check

- Middleware response redaction exists for HTTP content/widget responses after Pass 29.
- Realtime raw metadata remains in `PlaylistService.getDevicePlaylist()` for primary and fallback playlists.
- Realtime raw metadata remains in `DeviceGateway.sendInitialState()`.
- `DeviceGateway.resolveLayoutContent()` spreads layout metadata into device payloads; sanitization must apply before returning layout content.
- Cached playlists can predate the fix, so cached reads and `updateDevicePlaylist()` must sanitize as well.

## Implementation Plan

- [ ] Add failing `PlaylistService` tests proving generic API widget header values are redacted from cached, DB primary, DB fallback, and admin-updated playlists.
- [ ] Add failing `DeviceGateway` tests proving initial-state playlist payloads and layout metadata redact generic API widget headers before `client.emit()`.
- [ ] Add `realtime/src/services/device-content-payload.ts` with:
  - record-safe cloning
  - `redactDeviceContentMetadata()`
  - `redactDevicePlaylist()`
  - generic API `widgetConfig` stripping for device-bound payloads
- [ ] Wire sanitizer into:
  - cached playlist return path
  - DB playlist construction and cache writes
  - `updateDevicePlaylist()`
  - `sendPlaylistUpdate()`
  - `sendInitialState()`
  - `resolveLayoutContent()`
- [ ] Run focused realtime tests.
- [ ] Request security/realtime subagent review before broader verification.
- [ ] Run broader realtime verification and CI-safe checks.
- [ ] Commit, PR, wait for CI, merge if green, then re-check deploy gate without changing prod state.

## Test Plan

- `pnpm --filter @vizora/realtime test -- --runInBand --runTestsByPath src/services/playlist.service.spec.ts src/gateways/device.gateway.spec.ts`
- `pnpm --filter @vizora/realtime test -- --runInBand`
- `npx nx build @vizora/realtime --skip-nx-cache`
- `pnpm security:no-hardcoded-jwts`
- `git diff --check`

## Risks

- Devices may depend on non-secret widget metadata for template rendering. The sanitizer strips only generic API `widgetConfig` and preserves sibling metadata such as `isWidget`, `widgetType`, `renderedHtml`, `templateName`, layout `zones`, `resolvedPlaylist`, and `resolvedContent`.
- Cached and pending playlist payloads may contain stale raw metadata. Return-time/replay-time sanitization is required even if cache writes are fixed.
- Layout rendering paths must preserve `metadata.zones`, `resolvedPlaylist`, and `resolvedContent` shapes.

**Type-check note:** do not use `pnpm --filter @vizora/realtime exec tsc --noEmit` as a gate; the package tsconfig has empty `files`/`include`, so that command can exit 0 without checking the app. Use the Nx realtime build for compile coverage until a dedicated typecheck config exists.
