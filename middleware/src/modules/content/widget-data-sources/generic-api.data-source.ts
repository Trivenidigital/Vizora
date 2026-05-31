import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';
import { assertUrlIsPublic, SsrfError } from '../../common/utils/ssrf-guard';
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
 */
@Injectable()
export class GenericApiDataSource implements WidgetDataSource {
  private readonly logger = new Logger(GenericApiDataSource.name);

  readonly type = 'generic-api';

  private readonly REQUEST_TIMEOUT = 15_000;
  private readonly MAX_RESPONSE_BYTES = 1024 * 1024;

  constructor(private readonly circuitBreaker: CircuitBreakerService) {}

  async fetchData(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = config.url as string | undefined;
    if (!url) {
      this.logger.warn('No url provided, returning sample data');
      return this.getSampleData();
    }

    // PR-review fix (post-merge): replace hostname-only check with shared
    // SSRF guard that resolves DNS and classifies the resulting IPs. A
    // hostname-only regex is bypassable — a public-looking domain can
    // resolve to 127.0.0.1 / 169.254.169.254 / RFC1918, and fetch() would
    // happily connect. The guard re-runs on every fetch (widget polls
    // periodically), so a DNS-rebind that flips later is also caught.
    try {
      await assertUrlIsPublic(url, { allowHttp: true });
    } catch (err) {
      if (err instanceof SsrfError) {
        throw new BadRequestException(err.message);
      }
      throw err;
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
          // PR-review fix: customer headers spread BEFORE the defaults so
          // they CANNOT override User-Agent / Accept. Letting a customer
          // override User-Agent would bypass rate-limiting / WAF rules
          // that upstream services use to identify Vizora's outbound traffic.
          // PR-review fix (post-merge): redirect: 'manual' — a redirect
          // chain would bypass the SSRF guard, since the guard runs
          // against the original URL only. Treating 3xx as an error
          // forces customers to give us the final destination directly.
          // (Real APIs that intentionally redirect for v1 are rare; if
          // a customer hits this we can revisit with per-hop revalidation.)
          const res = await fetch(url, {
            method,
            headers: {
              ...headers,
              Accept: 'application/json',
              'User-Agent': 'Vizora-Widget/1.0',
            },
            signal: controller.signal,
            redirect: 'manual',
          });
          if (res.status >= 300 && res.status < 400) {
            throw new Error(
              `Endpoint returned HTTP ${res.status} redirect — final-destination URLs only (redirects not followed)`,
            );
          }
          if (!res.ok) {
            throw new Error(`Endpoint returned HTTP ${res.status}`);
          }

          let json: unknown;
          try {
            json = JSON.parse(await this.readJsonBodyWithLimit(res));
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

  private async readJsonBodyWithLimit(res: Response): Promise<string> {
    const contentLength = res.headers.get('content-length');
    if (contentLength) {
      const declaredBytes = Number(contentLength);
      if (Number.isFinite(declaredBytes) && declaredBytes > this.MAX_RESPONSE_BYTES) {
        await this.cancelResponseBody(res);
        throw new Error(`Endpoint response is too large; maximum is ${this.MAX_RESPONSE_BYTES} bytes`);
      }
    }

    if (!res.body) {
      const text = await res.text();
      if (Buffer.byteLength(text, 'utf8') > this.MAX_RESPONSE_BYTES) {
        throw new Error(`Endpoint response is too large; maximum is ${this.MAX_RESPONSE_BYTES} bytes`);
      }
      return text;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let receivedBytes = 0;
    let text = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
        if (receivedBytes > this.MAX_RESPONSE_BYTES) {
          await this.cancelReader(reader);
          throw new Error(`Endpoint response is too large; maximum is ${this.MAX_RESPONSE_BYTES} bytes`);
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      return text;
    } finally {
      reader.releaseLock();
    }
  }

  private async cancelResponseBody(res: Response): Promise<void> {
    try {
      await res.body?.cancel();
    } catch {
      // The size rejection is the important error; body cancellation is cleanup.
    }
  }

  private async cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    try {
      await reader.cancel();
    } catch {
      // Preserve the response-size error even if stream cancellation fails.
    }
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
    // Return the template FILENAME (without .hbs), matching the contract every
    // other data source follows (weather → 'weather', rss → 'rss', …).
    // loadWidgetTemplate() is filename-based: it sanitizes this value and loads
    // widget-templates/<name>.hbs. Returning inline Handlebars here made it
    // sanitize the markup to a garbage filename, miss the existing
    // widget-templates/generic-api.hbs, and silently fall back to a raw
    // <pre> JSON dump instead of the styled list the .hbs renders.
    return 'generic-api';
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
