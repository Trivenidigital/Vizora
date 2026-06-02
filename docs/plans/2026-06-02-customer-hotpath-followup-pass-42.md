# Customer Hot-Path Follow-up Pass 42

Date: 2026-06-02
Branch: `feat/customer-hotpath-followup-pass-42`

## Goal

Close adjacent customer-readiness gaps left after Pass 41:

- Electron display clients should not prefetch full video assets before playback.
- Public readiness should not leak dependency internals.
- Missing object-storage wiring should fail readiness because content upload and
  playback depend on storage.
- Device media stream failures after headers are sent should log enough request
  context to debug customer playback incidents.

## New primitives introduced

One Electron renderer preload-policy helper with three small predicates:
`shouldPreloadContentType`, `shouldReadCachedContent`, and
`shouldDownloadOnCacheMiss`.

No schema, env var, runtime process, notification path, realtime substrate, MCP
tool, Hermes skill, provider spend path, or parallel infrastructure.

## Hermes-first analysis

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Electron display preload policy | none found | build in existing display renderer |
| Public readiness response shaping | none found | build in existing NestJS health controller |
| Object-storage readiness requirement | none found | build in existing HealthService |
| Device media stream error context | none found | build in existing DeviceContentController |

Awesome-hermes-agent ecosystem check: no applicable runtime/library primitive
for Electron media preload policy, NestJS readiness shaping, or HTTP stream
error logging; proceed with Vizora-native code.

## Drift Check

Pass 41 already changed the web display client to preload image content only.
Electron still preloaded both image and video content in
`display/src/renderer/app.ts`, so the residual gap is specific to the packaged
display client.

Pass 41 removed `self_test_failures` from public `/health/ready`, but the
endpoint still returned the full dependency `checks` object. The residual gap
is public response shaping, not the internal health probe.

Pass 41 made MinIO unhealthy fail readiness, but a missing `StorageService`
dependency still reported degraded. For production readiness, missing storage
configuration is not optional.

Device-content streaming already destroys the response on post-header stream
errors, but the log line only included the stream error message. The residual
gap is incident-debug context.

## Implementation Plan

1. Add a small preload-policy helper in the display renderer and use it from
   `DisplayApp.preloadContent` plus playback cache-miss handling.
2. Return a minimal public readiness response with status, timestamp, uptime,
   version, and self-test status. Keep detailed dependency checks inside
   internal health paths.
3. Mark missing storage service as unhealthy in `HealthService`.
4. Pass request context into the device-content streaming helper and log
   request id, content id, path, and response status on stream failure.
5. Verify with focused display, health, and device-content tests, then broader
   builds/hygiene.
6. Send to orthogonal reviewers before PR/CI/merge.

## Deployment

Do not deploy unless production checkout is reconciled and safe. Current prod
state is dirty/diverged and therefore blocks automated deploys.
