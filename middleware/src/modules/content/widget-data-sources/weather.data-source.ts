import { Injectable, Logger } from '@nestjs/common';
import { WidgetDataSource } from './widget-data-source.interface';

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

  /**
   * Fetch weather data from OpenWeatherMap.
   *
   * @param config - Must contain at least `location`; optionally `units`,
   *   `showForecast`, and `forecastDays`.
   */
  async fetchData(config: Record<string, any>): Promise<Record<string, any>> {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPENWEATHER_API_KEY not set, returning sample data');
      return this.getSampleData();
    }

    const location = config.location || 'New York';
    const units = config.units || 'metric';
    const showForecast = config.showForecast ?? true;
    const forecastDays = config.forecastDays ?? 5;

    try {
      // --- current weather ---
      const currentUrl =
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      let currentData: any;
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

      const result: Record<string, any> = {
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
            `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&units=${units}&cnt=${forecastDays * 8}&appid=${apiKey}`;

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
              const dailyMap = new Map<string, any>();
              for (const entry of forecastData.list || []) {
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
    } catch (error) {
      this.logger.error(`Weather API fetch failed, returning sample data: ${error}`);
      return this.getSampleData();
    }
  }

  getConfigSchema(): Record<string, any> {
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

  getSampleData(): Record<string, any> {
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
