import { BadRequestException, BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import * as dns from 'dns/promises';
import { GenericApiDataSource } from './generic-api.data-source';
import { CircuitBreakerService, CircuitOpenError } from '../../common/services/circuit-breaker.service';

jest.mock('dns/promises');

/**
 * O8 — Generic API data source unit tests.
 *
 * Mirrors the RssDataSource spec shape but specific to JSON fetch +
 * dot-path extraction + SSRF / protocol / method validation.
 *
 * SSRF tests stub dns.lookup so tests don't depend on the test runner's
 * DNS resolver. Literal-IP URLs are handled by Node's dns.lookup by
 * returning the IP unchanged — we model that in the per-test mocks.
 */
describe('GenericApiDataSource', () => {
  let dataSource: GenericApiDataSource;
  let circuitBreaker: jest.Mocked<Pick<CircuitBreakerService, 'execute' | 'executeWithFallback'>>;
  const originalFetch = global.fetch;
  const mockLookup = dns.lookup as unknown as jest.Mock;
  const jsonResponse = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
      ...init,
    });

  beforeEach(() => {
    // Circuit breaker mock: execute the primary callback directly (skip fallback unless asked)
    circuitBreaker = {
      execute: jest.fn((_name, primary, _config) => primary()),
      executeWithFallback: jest.fn((_name, primary, _fallback) => primary()),
    } as any;
    dataSource = new GenericApiDataSource(circuitBreaker as unknown as CircuitBreakerService);

    // Default DNS mock: public IP so happy paths pass.
    mockLookup.mockReset();
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // SSRF + URL validation (synchronous fast-fail before fetch)
  // ---------------------------------------------------------------------------
  describe('URL + SSRF guard', () => {
    const sample = (url: string) => dataSource.fetchData({ url });

    it('returns sample data when no url is provided', async () => {
      const result = await dataSource.fetchData({});
      expect(result).toHaveProperty('data');
      expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
    });

    it('rejects a non-URL string with BadRequestException', async () => {
      await expect(sample('not-a-url')).rejects.toThrow(BadRequestException);
    });

    it('rejects ftp:// protocol', async () => {
      await expect(sample('ftp://example.com/file')).rejects.toThrow(BadRequestException);
    });

    it('rejects localhost (literal label, before DNS)', async () => {
      await expect(sample('http://localhost/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects 127.0.0.1', async () => {
      mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      await expect(sample('http://127.0.0.1/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects RFC1918 10.0.0.0/8', async () => {
      mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
      await expect(sample('http://10.0.0.5/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects RFC1918 192.168.0.0/16', async () => {
      mockLookup.mockResolvedValue([{ address: '192.168.1.1', family: 4 }]);
      await expect(sample('http://192.168.1.1/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects RFC1918 172.16.0.0/12', async () => {
      mockLookup.mockResolvedValue([{ address: '172.16.0.5', family: 4 }]);
      await expect(sample('http://172.16.0.5/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects link-local 169.254.0.0/16 (AWS/GCP/Azure IMDS)', async () => {
      mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
      await expect(sample('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(BadRequestException);
    });

    it('rejects IPv6 loopback ::1', async () => {
      mockLookup.mockResolvedValue([{ address: '::1', family: 6 }]);
      await expect(sample('http://[::1]/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects IPv6 link-local fe80::', async () => {
      mockLookup.mockResolvedValue([{ address: 'fe80::1', family: 6 }]);
      await expect(sample('http://[fe80::1]/path')).rejects.toThrow(BadRequestException);
    });

    // PR-review fix: additional IPv6 SSRF coverage
    it('rejects IPv6 unspecified ::', async () => {
      mockLookup.mockResolvedValue([{ address: '::', family: 6 }]);
      await expect(sample('http://[::]/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects IPv4-mapped IPv6 ::ffff:127.0.0.1 (bypassed v4 patterns before the fix)', async () => {
      mockLookup.mockResolvedValue([{ address: '::ffff:127.0.0.1', family: 6 }]);
      await expect(sample('http://[::ffff:127.0.0.1]/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects 6to4 2002:: prefix (can embed private IPv4)', async () => {
      mockLookup.mockResolvedValue([{ address: '2002:7f00:1::', family: 6 }]);
      await expect(sample('http://[2002:7f00:1::]/path')).rejects.toThrow(BadRequestException);
    });

    // PR-review fix (post-merge): DNS rebind — public-looking hostname
    // that resolves to a private IP. The pre-fix hostname-only regex
    // would have let this through; the new resolved-IP check catches it.
    it('rejects DNS rebind: public-looking hostname resolves to 127.0.0.1', async () => {
      mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      await expect(sample('https://attacker.example/x')).rejects.toThrow(BadRequestException);
    });

    it('rejects DNS rebind: public hostname resolves to AWS IMDS', async () => {
      mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
      await expect(sample('https://innocent.example/x')).rejects.toThrow(BadRequestException);
    });

    it('rejects non-GET method (v1 is GET-only)', async () => {
      await expect(
        dataSource.fetchData({ url: 'https://api.example.com/x', method: 'POST' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows public hostnames with non-default ports', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ ok: true })) as any;
      await expect(
        dataSource.fetchData({ url: 'https://api.example.com:8443/path' }),
      ).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Redirect handling (PR-review fix: redirect: 'manual')
  // ---------------------------------------------------------------------------
  describe('redirect handling', () => {
    it('treats a 3xx response as an error (no redirect-follow → SSRF cannot bypass)', async () => {
      circuitBreaker.executeWithFallback.mockImplementation(async (_name, primary, fallback) => {
        try {
          return await primary();
        } catch {
          return fallback();
        }
      });
      // 302 to an internal address would bypass the SSRF guard if we
      // followed redirects. Verify we reject without ever attempting hop 2.
      global.fetch = jest.fn().mockResolvedValue(
        new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }),
      ) as any;
      const result = await dataSource.fetchData({ url: 'https://api.example.com/x' });
      // Falls back to sample data (circuit breaker behaviour). Just need
      // to assert we never attempted the redirected URL — fetch was called
      // exactly once with the original URL.
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.example.com/x');
      expect(fetchCall[1].redirect).toBe('manual');
      expect(result.data).toBeInstanceOf(Array); // sample data
    });
  });

  // ---------------------------------------------------------------------------
  // Happy paths
  // ---------------------------------------------------------------------------
  describe('fetchData (happy path)', () => {
    it('returns { data, fetchedAt } when the endpoint responds with JSON', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ items: ['a', 'b', 'c'] })) as any;

      const result = await dataSource.fetchData({ url: 'https://api.example.com/x' });
      expect(result).toHaveProperty('data', { items: ['a', 'b', 'c'] });
      expect(result).toHaveProperty('fetchedAt');
    });

    it('applies responseRoot dot-path to extract nested data', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({ meta: { ts: 1 }, payload: { items: ['x', 'y'] } }),
      ) as any;

      const result = await dataSource.fetchData({
        url: 'https://api.example.com/x',
        responseRoot: 'payload.items',
      });
      expect(result.data).toEqual(['x', 'y']);
    });

    it('responseRoot that misses returns data=undefined (no throw)', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ a: 1 })) as any;

      const result = await dataSource.fetchData({
        url: 'https://api.example.com/x',
        responseRoot: 'missing.deep.path',
      });
      expect(result.data).toBeUndefined();
    });

    it('forwards custom headers to fetch', async () => {
      const fetchSpy = jest.fn().mockResolvedValue(jsonResponse({}));
      global.fetch = fetchSpy as any;

      await dataSource.fetchData({
        url: 'https://api.example.com/x',
        headers: { Authorization: 'Bearer xyz' },
      });

      const fetchOpts = fetchSpy.mock.calls[0][1];
      expect(fetchOpts.headers.Authorization).toBe('Bearer xyz');
      // Default Accept + UA still set
      expect(fetchOpts.headers.Accept).toBe('application/json');
      expect(fetchOpts.headers['User-Agent']).toBe('Vizora-Widget/1.0');
    });

    // PR-review fix: customer cannot override User-Agent or Accept via headers
    it('customer headers CANNOT override User-Agent or Accept (defense against WAF/rate-limit bypass)', async () => {
      const fetchSpy = jest.fn().mockResolvedValue(jsonResponse({}));
      global.fetch = fetchSpy as any;

      await dataSource.fetchData({
        url: 'https://api.example.com/x',
        headers: { 'User-Agent': 'AttackerBot/1.0', Accept: 'text/html' },
      });

      const fetchOpts = fetchSpy.mock.calls[0][1];
      expect(fetchOpts.headers['User-Agent']).toBe('Vizora-Widget/1.0');
      expect(fetchOpts.headers.Accept).toBe('application/json');
    });
  });

  describe('response size limits', () => {
    it('rejects oversized content-length before reading the body', async () => {
      const cancel = jest.fn();
      global.fetch = jest.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({ cancel }),
          { status: 200, headers: { 'content-length': String(1024 * 1024 + 1) } },
        ),
      ) as any;

      await expect(dataSource.fetchData({ url: 'https://api.example.com/x' }))
        .rejects.toThrow(/response is too large/i);
      expect(cancel).toHaveBeenCalled();
    });

    it('rejects chunked responses that exceed the body cap without content-length', async () => {
      const cancel = jest.fn();
      const oversizedChunk = new TextEncoder().encode(JSON.stringify({ data: 'x'.repeat(1024 * 1024 + 1) }));
      global.fetch = jest.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(oversizedChunk);
            },
            cancel,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ) as any;

      await expect(dataSource.fetchData({ url: 'https://api.example.com/x' }))
        .rejects.toThrow(/response is too large/i);
      expect(cancel).toHaveBeenCalled();
    });

    it('accepts valid under-limit JSON responses', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ data: ['small'] })) as any;

      await expect(dataSource.fetchData({ url: 'https://api.example.com/x' }))
        .resolves.toMatchObject({ data: { data: ['small'] } });
    });
  });

  // ---------------------------------------------------------------------------
  // Error paths — circuit-breaker fallback
  // ---------------------------------------------------------------------------
  describe('error paths fall back to sample data via circuit breaker', () => {
    beforeEach(() => {
      // Tests in this block want to verify the FALLBACK path is taken.
      // Configure circuitBreaker to RUN the fallback when primary throws.
      circuitBreaker.executeWithFallback.mockImplementation(async (_name, primary, fallback) => {
        try {
          return await primary();
        } catch {
          return fallback();
        }
      });
    });

    it('non-200 response → fallback to sample data', async () => {
      global.fetch = jest.fn().mockResolvedValue(new Response('error', { status: 500 })) as any;

      const result = await dataSource.fetchData({ url: 'https://api.example.com/x' });
      expect(result.data).toBeInstanceOf(Array); // sample data shape
    });

    it('endpoint returns non-JSON (malformed body) → fallback to sample data', async () => {
      global.fetch = jest.fn().mockResolvedValue(new Response('not json', { status: 200 })) as any;

      const result = await dataSource.fetchData({ url: 'https://api.example.com/x' });
      expect(result.data).toBeInstanceOf(Array);
    });

    it('AbortController timeout → fallback to sample data', async () => {
      global.fetch = jest.fn().mockImplementation(() => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }) as any;

      const result = await dataSource.fetchData({ url: 'https://api.example.com/x' });
      expect(result.data).toBeInstanceOf(Array);
    });

    it('oversized body falls back to sample data when circuit breaker handles the failure', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(
          { ok: true },
          { headers: { 'content-length': String(1024 * 1024 + 1) } },
        ),
      ) as any;

      const result = await dataSource.fetchData({ url: 'https://api.example.com/x' });
      expect(result.data).toBeInstanceOf(Array);
    });
  });

  describe('strict mode', () => {
    it('rejects missing url instead of returning sample data', async () => {
      await expect(dataSource.fetchData({}, { strict: true })).rejects.toThrow(BadRequestException);
      expect(circuitBreaker.execute).not.toHaveBeenCalled();
      expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
    });

    it('does not use fallback sample data when the upstream endpoint fails', async () => {
      global.fetch = jest.fn().mockResolvedValue(new Response('error', { status: 500 })) as any;

      await expect(
        dataSource.fetchData({ url: 'https://api.example.com/x' }, { strict: true }),
      ).rejects.toThrow(BadGatewayException);

      expect(circuitBreaker.execute).toHaveBeenCalled();
      expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
    });

    it('maps an open circuit to ServiceUnavailableException', async () => {
      circuitBreaker.execute.mockRejectedValue(
        new CircuitOpenError('generic-api', Date.now() + 30_000),
      );

      await expect(
        dataSource.fetchData({ url: 'https://api.example.com/x' }, { strict: true }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // WidgetDataSource interface compliance
  // ---------------------------------------------------------------------------
  describe('interface methods', () => {
    it('type is "generic-api"', () => {
      expect(dataSource.type).toBe('generic-api');
    });

    it('getConfigSchema returns a non-empty object with url field', () => {
      const schema = dataSource.getConfigSchema();
      expect(schema).toHaveProperty('url');
    });

    it('getDefaultTemplate returns the .hbs filename token, not inline markup', () => {
      // loadWidgetTemplate() is filename-based (reads widget-templates/<name>.hbs).
      // Returning inline Handlebars made it sanitize the markup to a garbage
      // filename, miss the .hbs, and throw — so generic-api widgets never
      // rendered. The contract is a bare filename, like every other source.
      const tpl = dataSource.getDefaultTemplate();
      expect(tpl).toBe('generic-api');
      expect(tpl).not.toContain('{{');
    });

    it('getSampleData returns a structurally-valid sample', () => {
      const sample = dataSource.getSampleData();
      expect(sample).toHaveProperty('data');
      expect(sample).toHaveProperty('fetchedAt');
    });
  });
});
