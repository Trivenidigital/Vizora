import { BadRequestException } from '@nestjs/common';
import { GenericApiDataSource } from './generic-api.data-source';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';

/**
 * O8 — Generic API data source unit tests.
 *
 * Mirrors the RssDataSource spec shape but specific to JSON fetch +
 * dot-path extraction + SSRF / protocol / method validation.
 */
describe('GenericApiDataSource', () => {
  let dataSource: GenericApiDataSource;
  let circuitBreaker: jest.Mocked<Pick<CircuitBreakerService, 'executeWithFallback'>>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Circuit breaker mock: execute the primary callback directly (skip fallback unless asked)
    circuitBreaker = {
      executeWithFallback: jest.fn((_name, primary, _fallback) => primary()),
    } as any;
    dataSource = new GenericApiDataSource(circuitBreaker as unknown as CircuitBreakerService);
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

    it('rejects localhost', async () => {
      await expect(sample('http://localhost/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects 127.0.0.1', async () => {
      await expect(sample('http://127.0.0.1/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects RFC1918 10.0.0.0/8', async () => {
      await expect(sample('http://10.0.0.5/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects RFC1918 192.168.0.0/16', async () => {
      await expect(sample('http://192.168.1.1/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects RFC1918 172.16.0.0/12', async () => {
      await expect(sample('http://172.16.0.5/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects link-local 169.254.0.0/16', async () => {
      await expect(sample('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(BadRequestException);
    });

    it('rejects IPv6 loopback ::1', async () => {
      await expect(sample('http://[::1]/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects IPv6 link-local fe80::', async () => {
      await expect(sample('http://[fe80::1]/path')).rejects.toThrow(BadRequestException);
    });

    it('rejects non-GET method (v1 is GET-only)', async () => {
      await expect(
        dataSource.fetchData({ url: 'https://api.example.com/x', method: 'POST' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows public hostnames with non-default ports', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }) as any;
      await expect(
        dataSource.fetchData({ url: 'https://api.example.com:8443/path' }),
      ).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Happy paths
  // ---------------------------------------------------------------------------
  describe('fetchData (happy path)', () => {
    it('returns { data, fetchedAt } when the endpoint responds with JSON', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: ['a', 'b', 'c'] }),
      }) as any;

      const result = await dataSource.fetchData({ url: 'https://api.example.com/x' });
      expect(result).toHaveProperty('data', { items: ['a', 'b', 'c'] });
      expect(result).toHaveProperty('fetchedAt');
    });

    it('applies responseRoot dot-path to extract nested data', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ meta: { ts: 1 }, payload: { items: ['x', 'y'] } }),
      }) as any;

      const result = await dataSource.fetchData({
        url: 'https://api.example.com/x',
        responseRoot: 'payload.items',
      });
      expect(result.data).toEqual(['x', 'y']);
    });

    it('responseRoot that misses returns data=undefined (no throw)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ a: 1 }),
      }) as any;

      const result = await dataSource.fetchData({
        url: 'https://api.example.com/x',
        responseRoot: 'missing.deep.path',
      });
      expect(result.data).toBeUndefined();
    });

    it('forwards custom headers to fetch', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
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
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as any;

      const result = await dataSource.fetchData({ url: 'https://api.example.com/x' });
      expect(result.data).toBeInstanceOf(Array); // sample data shape
    });

    it('endpoint returns non-JSON (malformed body) → fallback to sample data', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => { throw new SyntaxError('not json'); },
      }) as any;

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

    it('getDefaultTemplate returns a Handlebars string', () => {
      const tpl = dataSource.getDefaultTemplate();
      expect(typeof tpl).toBe('string');
      expect(tpl).toContain('{{');
    });

    it('getSampleData returns a structurally-valid sample', () => {
      const sample = dataSource.getSampleData();
      expect(sample).toHaveProperty('data');
      expect(sample).toHaveProperty('fetchedAt');
    });
  });
});
