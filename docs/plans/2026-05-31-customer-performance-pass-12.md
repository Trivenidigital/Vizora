# Customer Performance Pass 12

**Date:** 2026-05-31
**Branch:** `feat/customer-performance-pass-12`

## Goal

Reduce customer-visible performance risk in display playback, legacy template
data fetches, and realtime impression logging with small backend changes that
do not require schema changes, secrets, production state edits, or deploy-time
operator action.

## New primitives introduced

- Shared bounded JSON response reader for customer-configured external JSON
  endpoints.

## Hermes-first analysis

Not applicable. This pass does not add business agents, MCP tools, Hermes
skills, AI/provider calls, or spend paths.

## Reviewer Input

Two read-only reviewers ranked the following small, high-confidence targets:

- Device media revalidation currently opens MinIO streams on repeat cached
  requests, which is costly for looping display playback.
- Legacy template data-source fetches still use `response.json()` and do not
  share the 1 MiB body cap added to Generic API widgets.
- Every realtime content impression does a display lookup even though the
  authenticated socket already carries `organizationId`.

Larger valid findings are deferred into later passes: dashboard real health and
quota, shared dashboard Socket.IO provider, server-side content-library search,
playlist summary payloads, org broadcast scaling, and template refresh
scheduling.

## Design

### Device Media Revalidation

- Keep device JWT, content, and MinIO metadata caches intact.
- For non-unsatisfiable MinIO responses, honor matching `If-None-Match` /
  `If-Modified-Since` before opening an object stream.
- When the validator match came from a cached content/metadata lookup, recheck
  the content row and object metadata first so stale cached object keys do not
  produce false 304s.
- If live metadata has changed, use the live metadata for the response instead
  of stale cached headers.
- Preserve stale-object recovery when cached object keys disappear.

### Legacy Template JSON Body Cap

- Move the Generic API bounded response reader into a shared content utility.
- Use the same 1 MiB cap for legacy template `rest_api` / `json_url` data
  sources.
- Preserve existing SSRF guard, redirect revalidation, timeout, safe-header
  filtering, circuit-breaker fallback, and JSON-path behavior.

### Impression Logging Lookup Elimination

- Add an optional `organizationId` parameter to `HeartbeatService.logImpression`.
- Pass `client.data.organizationId` from the authenticated gateway handler.
- When `organizationId` is present, write `content_impressions` directly and
  skip the display lookup.
- Preserve the old lookup path for any direct/internal callers that do not have
  socket context.

## Tests

- Middleware unit tests for cached media validators returning 304 without
  opening MinIO object streams.
- Middleware regression tests for stale cached object keys not returning false
  304s.
- Template rendering unit tests for oversized `Content-Length`, chunked
  oversized JSON, under-limit JSON, and fallback behavior through the existing
  circuit breaker.
- Realtime service and gateway unit tests proving organization-aware
  impressions skip the display lookup and gateway passes socket org context.
