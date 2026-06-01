# Middleware Guardrail + Sanitize Fast Path Pass 32

**Date:** 2026-06-01
**Branch:** `feat/customer-experience-pass-32`

## Why Now

Recent customer-readiness passes fixed higher-trust dashboard issues and
several payload/realtime bottlenecks. The initial target for this pass was a
remaining repo-wide middleware hot path: the global `SanitizeInterceptor`
recursively walks every response object and passes every ordinary string
through `sanitize-html`, even when the string contains no HTML or entity
characters. Large content, display, playlist, or schedule list responses are
mostly safe identifiers, names, statuses, URLs, and timestamps, so this work is
repeated on the common case.

Synthetic baseline on 20,000 safe rows using the current sanitizer call pattern:
about 190 ms on this workstation. This is not a production metric, but it
confirms the cost is in the `sanitize-html` safe-string path.

Parallel customer/security review also found two bounded middleware tenant
guardrail gaps that are more urgent than opening a narrow performance-only PR:

- `PairingService.getActivePairings()` exposes brand-new unclaimed pairing
  requests to every tenant dashboard until the code is completed by an org.
- `DisplaysService.addTags()` validates the display's organization but writes
  `DisplayTag` rows for arbitrary tag IDs without proving those tags belong to
  the same organization.

## New Primitives Introduced

None. This pass changes only existing middleware service/interceptor behavior
and tests. No route, module, middleware ordering, process, database schema,
response envelope, realtime path, notification path, MCP tool, Hermes skill, or
provider spend path changes.

## Hermes-First Analysis

Not applicable. This pass does not add or modify business agents, MCP tools,
Hermes skills, AI/provider calls, or spend paths.

| Domain | Hermes skill found? | Decision |
|---|---|---|
| NestJS response sanitizer performance | none applicable | Optimize the existing Vizora interceptor in place. |
| Display pairing tenant visibility | none applicable | Tighten existing Vizora pairing service filtering. |
| Display tag tenant ownership | none applicable | Tighten existing Vizora display service validation. |

Awesome-Hermes ecosystem check: no applicable reusable skill for in-process
NestJS JSON sanitizer fast paths; keep this native to Vizora middleware.

## Scope

- Preserve global interceptor order and the existing input/output sanitation
  contract.
- Add a safe-string fast path that trims strings and returns immediately when
  no sanitizer-triggering characters are present.
- Keep `sanitize-html` for strings containing `<`, `>`, or `&`, because those
  can carry HTML tags or encoded entities.
- Keep template HTML field behavior unchanged: input template fields pass
  through for service-layer validation; output template fields use the existing
  permissive sanitizer.
- Add tests proving safe plain strings do not call `sanitize-html`, unsafe
  strings still do, whitespace trimming stays intact, and entity decoding still
  only applies to `&amp;` on output.
- Change active pairing dashboard visibility so completed pairings for the org
  still show, unclaimed requests for already-owned displays still show, and
  brand-new unclaimed requests stay hidden from tenant dashboards.
- Validate all tag IDs in `addTags()` with `organizationId` before any
  `DisplayTag` upsert. Reject the whole call if any tag is missing or belongs
  to another org. Deduplicate IDs before writing.
- Filter display tag relation reads by tag `organizationId` so any polluted
  historical `DisplayTag` rows cannot leak another org's tag metadata through
  display list/detail/update/create responses or `getTags()`.

## Implementation Plan

- Update `middleware/src/modules/common/interceptors/sanitize.interceptor.spec.ts`
  to mock `sanitize-html` while preserving its real behavior, then add red tests
  for safe-string fast-path behavior and unsafe-string fallback behavior.
- Update `middleware/src/modules/common/interceptors/sanitize.interceptor.ts`
  with a small `needsSanitizeHtml` helper and use it from `sanitizeString`.
- Update `middleware/src/modules/displays/pairing.service.spec.ts` with red
  tenant-visibility tests, then tighten `getActivePairings()`.
- Update `middleware/src/modules/displays/displays.service.spec.ts` with red
  cross-org tag tests, then validate tags in `addTags()`.
- Replace unscoped display tag relation selects with organization-scoped select
  builders and update `getTags()` with the same relation filter.
- Run focused interceptor tests, then broader middleware verification and build.
- Request multi-vector review before broader tests: security/XSS/tenant
  behavior and performance/regression impact.

## Risks

- Missing a sanitizer-triggering character would be a security regression.
  Mitigation: only skip when the trimmed string lacks `<`, `>`, and `&`; all
  actual HTML/entity cases still use the existing sanitizer.
- Changing trimming behavior would be a subtle API contract change. Mitigation:
  tests keep the existing whitespace trimming assertion.
- Template fields have special behavior. Mitigation: leave template field logic
  untouched and keep existing tests.
- Pairing dashboards may previously have shown nearby brand-new display codes.
  Mitigation: devices still poll their own code through the pairing status path;
  dashboards only lose cross-tenant visibility to requests not yet claimed by
  any organization.
- Tag validation adds one `tag.findMany` call per `addTags()` request. This is
  acceptable because tag assignment is a low-frequency write path and prevents
  cross-tenant joins.
- Display list/detail tag relation filtering adds an indexed relation predicate.
  The display query is already org-scoped and tag fanout is small, so this is
  preferable to returning and filtering cross-tenant rows in application code.
