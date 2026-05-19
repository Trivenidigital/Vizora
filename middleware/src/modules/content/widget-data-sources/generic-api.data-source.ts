import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';
import { WidgetDataSource } from './widget-data-source.interface';

/**
 * O8 — Generic HTTP-poll widget data source.
 *
 * Closes the audit's "API-to-screen data mapping" gap (P0 #3) for the common
 * JSON case. Customer pastes a GET URL, optional headers, optional
 * `responseRoot` dot-path, and the widget renders the response into a
 * template. No per-vendor connector required.
 *
 * Mirrors `RssDataSource` exactly: same SSRF block list, same circuit
 * breaker fallback, same 15s AbortController timeout. JSON-only for v1 —
 * XML and CSV are deferred follow-ups.
 *
 * Lean cut intentionally omits:
 *   - POST bodies (GET only for v1)
 *   - OAuth flows (customer can paste a Bearer token into headers)
 *   - Full JSONPath ($.store.book[?(@.price < 10)]) — simple dot-path
 *     covers the typical case; full JSONPath needs a dependency
 *   - Response size limits — acceptable v1 risk; add a content-length
 *     check if real customers report issues
 */
@Injectable()
export class GenericApiDataSource implements WidgetDataSource {
  private readonly logger = new Logger(GenericApiDataSource.name);

  readonly type = 'generic-api';

  private readonly REQUEST_TIMEOUT = 15_000;

  /**
   * SSRF block list — copied verbatim from RssDataSource.
   * 10 patterns covering: localhost names; IPv4 loopback (127.0.0.0/8);
   * RFC1918 private ranges (10/8, 172.16/12, 192.168/16); IPv4 unspecified
   * (0.0.0.0/8); link-local (169.254/16); IPv6 loopback (::1); IPv6 ULA
   * (fc00::/7); IPv6 link-local (fe80::/10).
   */
  private readonly BLOCKED_HOSTS: RegExp[] = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];

  constructor(private readonly circuitBreaker: CircuitBreakerService) {}

  async fetchData(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = config.url as string | undefined;
    if (!url) {
      this.logger.warn('No url provided, returning sample data');
      return this.getSampleData();
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('URL is not a valid absolute URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('URL must use HTTP or HTTPS');
    }
    // Node's URL parser returns IPv6 hostnames WITH brackets (e.g. "[fe80::1]").
    // Strip them before matching the SSRF block-list regexes, which are
    // written to match the bare address text. RssDataSource has the same
    // gap; the bracket-stripping makes the IPv6 patterns actually fire.
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (this.BLOCKED_HOSTS.some((p) => p.test(hostname))) {
      throw new BadRequestException('URL points to a blocked address');
    }

    const method = ((config.method as string) ?? 'GET').toUpperCase();
    if (method !== 'GET') {
      // v1 is GET-only. Restricting here prevents accidental data writes by
      // a widget config — POSTing to an arbitrary URL is an explicit feature
      // we'll add when there's a real use case.
      throw new BadRequestException('Only GET is supported in v1');
    }

    const headers = (config.headers as Record<string, string> | undefined) ?? {};
    const responseRoot = config.responseRoot as string | undefined;

    return this.circuitBreaker.executeWithFallback(
      'generic-api',
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

        try {
          const res = await fetch(url, {
            method,
            headers: {
              Accept: 'application/json',
              'User-Agent': 'Vizora-Widget/1.0',
              ...headers,
            },
            signal: controller.signal,
          });
          if (!res.ok) {
            throw new Error(`Endpoint returned HTTP ${res.status}`);
          }

          let json: unknown;
          try {
            json = await res.json();
          } catch (err) {
            throw new Error(
              `Endpoint did not return valid JSON: ${err instanceof Error ? err.message : 'unknown'}`,
            );
          }

          const extracted = responseRoot ? this.dotPath(json, responseRoot) : json;

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
   * Simple dot-path extraction. `'data.items'` → `obj.data.items`.
   * Returns `undefined` on miss; caller wraps the result and template
   * renders empty (same behavior as a missing weather field today).
   *
   * No bracket / wildcard / filter support — that's full JSONPath
   * territory and needs a dependency.
   */
  private dotPath(obj: unknown, path: string): unknown {
    if (!path) return obj;
    return path.split('.').reduce<unknown>(
      (acc, key) =>
        acc !== null && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      url: {
        type: 'string',
        label: 'API URL',
        placeholder: 'https://api.example.com/menu',
        required: true,
      },
      method: {
        type: 'select',
        label: 'HTTP Method',
        options: ['GET'],
        default: 'GET',
      },
      headers: {
        type: 'object',
        label: 'Headers (JSON)',
        placeholder: '{"Authorization": "Bearer <token>"}',
      },
      responseRoot: {
        type: 'string',
        label: 'Response Root (dot-path)',
        placeholder: 'data.items',
      },
      refreshIntervalMin: {
        type: 'select',
        label: 'Refresh (min)',
        options: ['5', '15', '30', '60'],
        default: '15',
      },
    };
  }

  getDefaultTemplate(): string {
    return `
{{#if data}}
  {{#if (isArray data)}}
    <ul>{{#each data}}<li>{{this}}</li>{{/each}}</ul>
  {{else}}
    <pre>{{json data}}</pre>
  {{/if}}
{{else}}
  <p>No data.</p>
{{/if}}
`.trim();
  }

  getSampleData(): Record<string, unknown> {
    return {
      data: [
        { id: 1, name: 'Sample Item A', price: 9.99 },
        { id: 2, name: 'Sample Item B', price: 14.5 },
        { id: 3, name: 'Sample Item C', price: 7.25 },
      ],
      fetchedAt: new Date().toISOString(),
    };
  }
}
