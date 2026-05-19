# O8 — Generic API-to-Screen Data Source — Plan

**Date:** 2026-05-19
**Audit ref:** P0 #3 (`docs/plans/2026-05-17-optsigns-vizora-feature-gap.md`)
**Backlog ref:** `backlog.md` → "OptiSigns Parity Roadmap" → O8
**Branch:** `feat/o8-generic-api-data-source`
**Effort:** S (1 dev-day — JSON only; XML/CSV deferred)
**Drift-check tag:** `extends-Hermes`

Lean cut: one new widget data source `'generic-api'` that polls an HTTP endpoint, applies SSRF guard, parses JSON, plucks configurable fields, and returns to template renderer. Same shape as the existing `RssDataSource`. Closes the audit's "API-to-screen data mapping" gap for the common JSON case without dragging in XML/CSV parsing libraries.

## Hermes-first capability checklist

All 7 steps `[net-new]` against Hermes substrate. Vizora-widget-infrastructure work.

| # | Step | Tag | Why |
|---|------|-----|-----|
| 1 | New `GenericApiDataSource` class implementing `WidgetDataSource` interface | `[net-new]` | Vizora widget pattern |
| 2 | SSRF guard mirroring `RssDataSource` (block localhost, RFC1918, link-local, loopback) | `[net-new]` | Application logic |
| 3 | Circuit breaker wrapper for the HTTP fetch (matches RSS pattern with name `'generic-api'`) | `[net-new]` | Reuse existing CircuitBreakerService |
| 4 | AbortController-based 15s timeout (matches RssDataSource.REQUEST_TIMEOUT) | `[net-new]` | Defense against slow-loris |
| 5 | Simple dot-path JSON extractor for `responseRoot` config (e.g. `data.items` → response.data.items) | `[net-new]` | Application logic — no jsonpath dep |
| 6 | Register in `DataSourceRegistryService` constructor | `[net-new]` | Existing registry pattern |
| 7 | Unit tests covering: happy path / SSRF blocked URL / non-200 response / timeout / malformed JSON / dot-path extraction | `[net-new]` | Jest |

**Red-flag check:** 7/7 `[net-new]` is correct — pure widget infrastructure work, Hermes orthogonal.

## Drift-rule self-checks

- ✅ Read `middleware/src/modules/content/widget-data-sources/widget-data-source.interface.ts` (lines 1-36 — confirmed 4-method interface: `fetchData`, `getConfigSchema`, `getDefaultTemplate`, `getSampleData`; type field; mirror this).
- ✅ Read `middleware/src/modules/content/widget-data-sources/rss.data-source.ts` (lines 1-80 — confirmed SSRF block list, AbortController timeout pattern, circuit-breaker wrapper, fall-back to sample data on circuit open. Going to mirror this exactly).
- ✅ Read `middleware/src/modules/content/data-source-registry.service.ts` (full file — registry constructor pattern: inject the new data source, set in map by `type`).
- ✅ Read `middleware/src/modules/content/widget-data-sources/index.ts` (re-exports — need to add `GenericApiDataSource` here).

## Problem

Today Vizora ships fixed-type widgets (weather, RSS, Twitter/Instagram/Facebook, clock, Google Sheets). For anything else — POS feeds, business dashboards, custom backend APIs — the customer must wait for a per-vendor connector. The audit P0 #3 calls this out as "API-to-screen data mapping" gap.

One generic widget that takes an HTTP URL + a field path covers the long tail: menu boards from a custom kitchen API, lobby greetings from a CRM endpoint, conference-room status from an in-house service.

## Goals

1. New `GenericApiDataSource` with `type: 'generic-api'`.
2. Config: `{ url, method?, headers?, responseRoot?, refreshIntervalMin? }`. Method defaults to GET. Headers optional. `responseRoot` is a dot-path string ('data.items'); if omitted, return raw JSON.
3. SSRF guard, 15s timeout, circuit breaker — matches RSS pattern exactly.
4. Register in `DataSourceRegistryService`.
5. Update widget controller's allowed-type list to include `'generic-api'` (one-line change).

## Non-goals

- XML parsing — defer to a follow-up. JSON covers ~90% of integrations.
- CSV parsing — defer.
- Full JSONPath (`$.store.book[?(@.price < 10)]`) — defer. Simple dot-path covers the typical case.
- POST bodies — defer. GET-only for v1.
- Authentication beyond static headers (OAuth flows, refresh tokens) — defer. Customers can paste a Bearer token into the headers config; OAuth handshake is its own feature.

## Affected files

```
middleware/src/modules/content/widget-data-sources/generic-api.data-source.ts        (NEW)
middleware/src/modules/content/widget-data-sources/generic-api.data-source.spec.ts   (NEW)
middleware/src/modules/content/widget-data-sources/index.ts                          (MODIFIED — re-export)
middleware/src/modules/content/data-source-registry.service.ts                       (MODIFIED — register)
middleware/src/modules/content/content.module.ts                                     (MODIFIED — provider list IF needed; possibly auto via existing registration)
middleware/src/modules/content/controllers/widgets.controller.ts                     (MODIFIED — add 'generic-api' to allowed type list IF the controller validates types client-side, else not needed)
```

## Service shape

```ts
@Injectable()
export class GenericApiDataSource implements WidgetDataSource {
  readonly type = 'generic-api';
  private readonly REQUEST_TIMEOUT = 15000;
  // Same blocked-host list as RssDataSource
  private readonly BLOCKED_HOSTS = [/* RFC1918 + localhost + link-local + IPv6 loopback/ULA/link-local */];

  constructor(private readonly circuitBreaker: CircuitBreakerService) {}

  async fetchData(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = config.url as string;
    if (!url) return this.getSampleData();

    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('URL must use HTTP or HTTPS');
    }
    if (this.BLOCKED_HOSTS.some(p => p.test(parsed.hostname))) {
      throw new BadRequestException('URL points to a blocked address');
    }

    return this.circuitBreaker.executeWithFallback(
      'generic-api',
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

        try {
          const res = await fetch(url, {
            method: (config.method as string) ?? 'GET',
            headers: (config.headers as Record<string, string>) ?? {},
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`Endpoint returned HTTP ${res.status}`);

          const json = await res.json();
          const root = config.responseRoot as string | undefined;
          const extracted = root ? this.dotPath(json, root) : json;

          return { data: extracted, fetchedAt: new Date().toISOString() };
        } finally {
          clearTimeout(timeoutId);
        }
      },
      () => {
        this.logger.warn('generic-api circuit open or failed, returning sample data');
        return this.getSampleData();
      },
    );
  }

  /**
   * Simple dot-path extraction. 'data.items' → obj.data.items.
   * No bracket / wildcard / filter support — that's full JSONPath territory.
   * Returns undefined (not null) on miss; caller falls back appropriately.
   */
  private dotPath(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>(
      (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
      obj,
    );
  }

  getConfigSchema(): Record<string, unknown> { /* JSON schema with url, method, headers, responseRoot, refreshIntervalMin */ }
  getDefaultTemplate(): string { /* basic Handlebars loop over `data` */ }
  getSampleData(): Record<string, unknown> { /* realistic 3-item sample */ }
}
```

## Tests (~10 cases)

- Happy path: GET https://api.example.com/menu → returns extracted data + fetchedAt
- SSRF: localhost → BadRequestException
- SSRF: 192.168.1.1 → BadRequestException
- SSRF: IPv6 link-local fe80:: → BadRequestException
- Wrong protocol: ftp:// → BadRequestException
- Non-200 response → circuit-breaker fallback returns sample data
- Timeout (mock AbortController abort) → circuit-breaker fallback returns sample data
- Malformed JSON → caught + fallback to sample
- `responseRoot: 'data.items'` extracts the nested array
- `responseRoot` pointing at missing key → extracted value is `undefined`; the wrapper returns `{ data: undefined, fetchedAt }` (no throw)
- Custom headers + custom method are forwarded to fetch correctly

## Acceptance criteria

- [ ] `tsc --noEmit` clean
- [ ] All new tests pass
- [ ] Existing widget-data-source tests pass unchanged
- [ ] Registered in DataSourceRegistryService; `get('generic-api')` returns the instance
- [ ] SSRF guard blocks the same address classes as RssDataSource
- [ ] No new dependencies in package.json

## Risks

| Risk | Mitigation |
|---|---|
| Customer's API responds slowly under load | 15s timeout + circuit breaker; fallback to sample data |
| Customer pastes a private URL by accident | SSRF guard rejects with 400 + helpful message |
| Customer's API returns huge JSON (10MB+) | `res.json()` doesn't enforce limits today. Acceptable for v1; if it becomes a problem, add a `res.text()` + manual `JSON.parse` after size check |
| Field-pluck doesn't find the path | Returns `undefined`, template renders empty — same behavior as a missing weather field today |
