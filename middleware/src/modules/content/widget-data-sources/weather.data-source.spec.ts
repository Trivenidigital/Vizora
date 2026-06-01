import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WeatherDataSource } from './weather.data-source';
import {
  CircuitBreakerService,
  CircuitOpenError,
} from '../../common/services/circuit-breaker.service';

describe('WeatherDataSource', () => {
  let dataSource: WeatherDataSource;
  let circuitBreaker: jest.Mocked<
    Pick<CircuitBreakerService, 'execute' | 'executeWithFallback'>
  >;
  const originalFetch = global.fetch;
  const originalOpenWeatherApiKey = process.env.OPENWEATHER_API_KEY;

  beforeEach(() => {
    circuitBreaker = {
      execute: jest.fn((_name, primary, _config) => primary()),
      executeWithFallback: jest.fn((_name, primary, _fallback) => primary()),
    } as any;
    dataSource = new WeatherDataSource(
      circuitBreaker as unknown as CircuitBreakerService,
    );
    process.env.OPENWEATHER_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENWEATHER_API_KEY = originalOpenWeatherApiKey;
    jest.restoreAllMocks();
  });

  it('keeps preview/non-strict mode sample-backed when OPENWEATHER_API_KEY is missing', async () => {
    delete process.env.OPENWEATHER_API_KEY;

    const result = await dataSource.fetchData({ location: 'Austin' });

    expect(result).toHaveProperty('current');
    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });

  it('rejects missing location in strict mode', async () => {
    await expect(dataSource.fetchData({}, { strict: true })).rejects.toThrow(
      BadRequestException,
    );

    expect(circuitBreaker.execute).not.toHaveBeenCalled();
    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });

  it('rejects missing API key in strict mode instead of returning sample data', async () => {
    delete process.env.OPENWEATHER_API_KEY;

    await expect(
      dataSource.fetchData({ location: 'Austin' }, { strict: true }),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(circuitBreaker.execute).not.toHaveBeenCalled();
    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });

  it('rejects invalid units in strict mode before constructing provider URLs', async () => {
    await expect(
      dataSource.fetchData(
        { location: 'Austin', units: 'metric&appid=attacker' },
        { strict: true },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(circuitBreaker.execute).not.toHaveBeenCalled();
    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });

  it('does not use fallback sample data when the weather provider fails in strict mode', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('error', { status: 500 })) as any;

    await expect(
      dataSource.fetchData({ location: 'Austin' }, { strict: true }),
    ).rejects.toThrow(BadGatewayException);

    expect(circuitBreaker.execute).toHaveBeenCalled();
    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });

  it('maps an open weather circuit to ServiceUnavailableException in strict mode', async () => {
    circuitBreaker.execute.mockRejectedValue(
      new CircuitOpenError('openweathermap-api', Date.now() + 30_000),
    );

    await expect(
      dataSource.fetchData({ location: 'Austin' }, { strict: true }),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(circuitBreaker.executeWithFallback).not.toHaveBeenCalled();
  });
});
