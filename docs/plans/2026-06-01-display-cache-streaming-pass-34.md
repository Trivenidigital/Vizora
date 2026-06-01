# Display Cache Streaming Pass 34

## Scope

Use the existing browser display cache during playback. The display client
already preloads the first media URLs in a playlist into the Cache API, but the
renderer still fetches protected device-content images as blobs and videos use
the network URL directly. Preloaded content should be read cache-first so screen
transitions avoid repeat network fetches and keep working better under spotty
connectivity.

## New primitives introduced

None. This pass only wires existing display cache hooks into existing renderer
components and adds focused tests. It adds no schema, route, module, response
shape, middleware, realtime path, notification path, MCP tool, Hermes skill,
provider spend path, env var, or production process.

## Hermes-first analysis

Not applicable. This pass does not add or modify business agents, MCP tools,
Hermes skills, AI/provider calls, or spend paths.

## Drift Check

Existing code evidence:

- `DisplayClient` calls `preloadItems()` for the first five image/video playlist
  URLs.
- `useBrowserCache()` exposes `getCachedUrl()`, but no playback component calls
  it.
- `ContentRenderer` fetches protected device-content images via `fetch()` every
  mount and renders videos from the authenticated URL directly.

## Performance Budget

For a preloaded protected device-content media URL, playback should not perform
an additional network `fetch()` before rendering. Cache misses must preserve
existing behavior: protected images keep their blob-fetch fallback and videos
keep direct URL playback.

## Implementation Plan

1. Add failing renderer tests proving cached protected images/videos use cached
   object URLs and skip network fetches.
2. Pass `getCachedUrl()` from `DisplayClient` through `ContentScreen`,
   `ContentRenderer`, and layout zones.
3. Add a cache-first media object URL hook with proper object URL cleanup.
4. Run focused display tests, review gate, broader web checks, and build.

## Deployment

No deployment by default. Re-check the production checkout first; deployment
remains blocked if `/opt/vizora/app` is dirty or diverged.
