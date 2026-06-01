import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as dns from 'dns/promises';
import { RssDataSource } from './rss.data-source';
import {
  CircuitBreakerService,
  CircuitOpenError,
} from '../../common/services/circuit-breaker.service';

jest.mock('dns/promises');

describe('RssDataSource', () => {
  let dataSource: RssDataSource;
  let circuitBreaker: jest.Mocked<
    Pick<CircuitBreakerService, 'execute' | 'executeWithFallback'>
  >;
  const originalFetch = global.fetch;
  const mockLookup = dns.lookup as unknown as jest.Mock;

  beforeEach(() => {
    circuitBreaker = {
      execute: jest.fn((_name, primary, _config) => primary()),
      executeWithFallback: jest.fn((_name, primary, _fallback) => primary()),
    } as any;
    dataSource = new RssDataSource(
      circuitBreaker as unknown as CircuitBreakerService,
    );
    mockLookup.mockReset();
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('keeps preview/non-strict mode sample-backed when feedUrl is missing', async () => {
    const result = await dataSource.fetchData({});

    expect(result).toHaveProperty('items');
    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });

  it('rejects missing feedUrl in strict mode', async () => {
    await expect(dataSource.fetchData({}, { strict: true })).rejects.toThrow(
      BadRequestException,
    );

    expect(circuitBreaker.execute).not.toHaveBeenCalled();
    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });

  it('rejects malformed feedUrl with BadRequestException', async () => {
    await expect(
      dataSource.fetchData({ feedUrl: 'not-a-url' }, { strict: true }),
    ).rejects.toThrow(BadRequestException);

    expect(circuitBreaker.execute).not.toHaveBeenCalled();
  });

  it('does not use fallback sample data when the feed provider fails in strict mode', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('error', { status: 500 })) as any;

    await expect(
      dataSource.fetchData(
        { feedUrl: 'https://example.com/rss.xml' },
        { strict: true },
      ),
    ).rejects.toThrow(BadGatewayException);

    expect(circuitBreaker.execute).toHaveBeenCalled();
    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });

  it('rejects public-looking hostnames that resolve to private addresses', async () => {
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    await expect(
      dataSource.fetchData(
        { feedUrl: 'https://attacker.example/rss.xml' },
        { strict: true },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(global.fetch).toBe(originalFetch);
  });

  it('rejects redirects to blocked addresses instead of falling back to sample data', async () => {
    mockLookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }]);
    global.fetch = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      }),
    ) as any;

    await expect(
      dataSource.fetchData(
        { feedUrl: 'https://example.com/rss.xml' },
        { strict: true },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });

  it('rejects oversized RSS responses in strict mode', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('x', {
        status: 200,
        headers: { 'content-length': String(2 * 1024 * 1024 + 1) },
      }),
    ) as any;

    await expect(
      dataSource.fetchData(
        { feedUrl: 'https://example.com/rss.xml' },
        { strict: true },
      ),
    ).rejects.toThrow(BadGatewayException);
  });

  it('maps an open RSS circuit to ServiceUnavailableException in strict mode', async () => {
    circuitBreaker.execute.mockRejectedValue(
      new CircuitOpenError('rss-feed', Date.now() + 30_000),
    );

    await expect(
      dataSource.fetchData(
        { feedUrl: 'https://example.com/rss.xml' },
        { strict: true },
      ),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });
});
