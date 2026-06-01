import { Injectable, Logger, BadRequestException, BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { CircuitBreakerService, CircuitOpenError } from '../../common/services/circuit-breaker.service';
import { WidgetDataSource, WidgetFetchOptions } from './widget-data-source.interface';

/** OpenWeatherMap API response shape (partial) */
interface WeatherApiResponse {
  main?: { temp?: number; feels_like?: number; humidity?: number };
  wind?: { speed?: number };
  weather?: Array<{ description?: string; icon?: string; id?: number }>;
  name?: string;
  sys?: { country?: string };
}

/** OpenWeatherMap forecast list item */
interface ForecastItem {
  dt_txt?: string;
  main?: { temp?: number; temp_max?: number; temp_min?: number };
  weather?: Array<{ description?: string; icon?: string; id?: number }>;
}

const WEATHER_CIRCUIT_CONFIG = {
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  successThreshold: 2,
  failureWindow: 60000,
};

/**
 * Weather widget data source.
 *
 * Fetches current conditions and forecast from the OpenWeatherMap API.
 * Falls back to sample data when the API key is missing or the request fails.
 */
@Injectable()
export class WeatherDataSource implements WidgetDataSource {
  private readonly logger = new Logger(WeatherDataSource.name);

  readonly type = 'weather';

  private readonly REQUEST_TIMEOUT = 10000;

  constructor(private readonly circuitBreaker: CircuitBreakerService) {}

  /**
   * Fetch weather data from OpenWeatherMap.
   *
   * @param config - Must contain at least `location`; optionally `units`,
   *   `showForecast`, and `forecastDays`.
   */
  async fetchData(config: Record<string, unknown>, options: WidgetFetchOptions = {}): Promise<Record<string, unknown>> {
    const strict = options.strict === true;
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      if (strict) {
        throw new ServiceUnavailableException('Weather provider is not configured');
      }
      this.logger.warn('OPENWEATHER_API_KEY not set, returning sample data');
      return this.getSampleData();
    }

    const location = typeof config.location === 'string' ? config.location.trim() : '';
    if (!location && strict) {
      throw new BadRequestException('Weather location is required');
    }
    const resolvedLocation = location || 'New York';
    const requestedUnits = typeof config.units === 'string' ? config.units : 'metric';
    if (!['metric', 'imperial', 'standard'].includes(requestedUnits)) {
      if (strict) {
        throw new BadRequestException('Weather units must be metric, imperial, or standard');
      }
    }
    const units = ['metric', 'imperial', 'standard'].includes(requestedUnits) ? requestedUnits : 'metric';
    const showForecast = config.showForecast ?? true;
    const forecastDays = config.forecastDays ?? 5;

    const fetchLiveData = async () => {
        // --- current weather ---
        const currentUrl =
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(resolvedLocation)}&units=${units}&appid=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

        let currentData: WeatherApiResponse;
        try {
          const res = await fetch(currentUrl, {
            headers: { 'User-Agent': 'Vizora-Widget/1.0' },
            signal: controller.signal,
          });

          if (!res.ok) {
            throw new Error(`OpenWeatherMap current weather API returned ${res.status}`);
          }
          currentData = await res.json();
        } finally {
          clearTimeout(timeoutId);
        }

        const result: Record<string, unknown> = {
          current: {
            temp: currentData.main?.temp,
            feelsLike: currentData.main?.feels_like,
            humidity: currentData.main?.humidity,
            windSpeed: currentData.wind?.speed,
            description: currentData.weather?.[0]?.description,
            icon: currentData.weather?.[0]?.icon,
            conditionCode: currentData.weather?.[0]?.id,
          },
          location: {
            name: currentData.name,
            country: currentData.sys?.country,
          },
        };

        // --- forecast (optional) ---
        if (showForecast) {
          try {
            const forecastUrl =
              `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(resolvedLocation)}&units=${units}&cnt=${forecastDays * 8}&appid=${apiKey}`;

            const fc = new AbortController();
            const fcTimeout = setTimeout(() => fc.abort(), this.REQUEST_TIMEOUT);

            try {
              const fRes = await fetch(forecastUrl, {
                headers: { 'User-Agent': 'Vizora-Widget/1.0' },
                signal: fc.signal,
              });

              if (fRes.ok) {
                const forecastData = await fRes.json();
                // Group by day (take one entry per day at noon if available)
                const dailyMap = new Map<string, Record<string, unknown>>();
                for (const entry of (forecastData.list || []) as ForecastItem[]) {
                  const date = entry.dt_txt?.split(' ')[0];
                  if (date && !dailyMap.has(date)) {
                    dailyMap.set(date, {
                      date,
                      temp: entry.main?.temp,
                      tempMin: entry.main?.temp_min,
                      tempMax: entry.main?.temp_max,
                      description: entry.weather?.[0]?.description,
                      icon: entry.weather?.[0]?.icon,
                      conditionCode: entry.weather?.[0]?.id,
                    });
                  }
                }
                result.forecast = Array.from(dailyMap.values()).slice(0, forecastDays);
              }
            } finally {
              clearTimeout(fcTimeout);
            }
          } catch (forecastError) {
            this.logger.warn(`Failed to fetch forecast: ${forecastError}`);
            result.forecast = [];
          }
        }

        return result;
    };

    if (strict) {
      try {
        return await this.circuitBreaker.execute('openweathermap-api', fetchLiveData, WEATHER_CIRCUIT_CONFIG);
      } catch (error) {
        throw this.toStrictFetchException(error, 'Weather');
      }
    }

    return this.circuitBreaker.executeWithFallback(
      'openweathermap-api',
      fetchLiveData,
      () => {
        this.logger.warn('Weather API circuit open or failed, returning sample data');
        return this.getSampleData();
      },
      WEATHER_CIRCUIT_CONFIG,
    );
  }

  private toStrictFetchException(error: unknown, providerName: string): Error {
    if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) return error;
    if (error instanceof CircuitOpenError) {
      return new ServiceUnavailableException(`${providerName} provider is temporarily unavailable`);
    }
    const message = error instanceof Error ? error.message : 'Unknown provider error';
    return new BadGatewayException(`${providerName} provider failed: ${message}`);
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name or "city,country" (e.g., "London,UK")',
          default: 'New York',
        },
        units: {
          type: 'string',
          enum: ['metric', 'imperial'],
          description: 'Temperature units',
          default: 'metric',
        },
        showForecast: {
          type: 'boolean',
          description: 'Whether to show multi-day forecast',
          default: true,
        },
        forecastDays: {
          type: 'number',
          description: 'Number of forecast days (1-5)',
          minimum: 1,
          maximum: 5,
          default: 5,
        },
      },
      required: ['location'],
    };
  }

  getDefaultTemplate(): string {
    return 'weather';
  }

  getSampleData(): Record<string, unknown> {
    return {
      current: {
        temp: 22,
        feelsLike: 20,
        humidity: 65,
        windSpeed: 5.4,
        description: 'partly cloudy',
        icon: '02d',
        conditionCode: 802,
      },
      forecast: [
        { date: '2026-02-09', temp: 18, tempMin: 14, tempMax: 22, description: 'light rain', icon: '10d', conditionCode: 500 },
        { date: '2026-02-10', temp: 20, tempMin: 16, tempMax: 24, description: 'clear sky', icon: '01d', conditionCode: 800 },
        { date: '2026-02-11', temp: 17, tempMin: 13, tempMax: 21, description: 'overcast clouds', icon: '04d', conditionCode: 804 },
        { date: '2026-02-12', temp: 19, tempMin: 15, tempMax: 23, description: 'scattered clouds', icon: '03d', conditionCode: 802 },
        { date: '2026-02-13', temp: 21, tempMin: 17, tempMax: 25, description: 'few clouds', icon: '02d', conditionCode: 801 },
      ],
      location: {
        name: 'New York',
        country: 'US',
      },
    };
  }
}
