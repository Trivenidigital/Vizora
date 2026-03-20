'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';

/** Weather condition code to emoji mapping */
function getWeatherEmoji(conditionCode: number | undefined): string {
  if (!conditionCode) return '\u2601\uFE0F'; // cloud
  if (conditionCode >= 200 && conditionCode < 300) return '\u26C8\uFE0F'; // thunderstorm
  if (conditionCode >= 300 && conditionCode < 400) return '\uD83C\uDF27\uFE0F'; // drizzle
  if (conditionCode >= 500 && conditionCode < 600) return '\uD83C\uDF27\uFE0F'; // rain
  if (conditionCode >= 600 && conditionCode < 700) return '\u2744\uFE0F'; // snow
  if (conditionCode >= 700 && conditionCode < 800) return '\uD83C\uDF2B\uFE0F'; // atmosphere/fog
  if (conditionCode === 800) return '\u2600\uFE0F'; // clear
  if (conditionCode === 801) return '\uD83C\uDF24\uFE0F'; // few clouds
  if (conditionCode === 802) return '\u26C5'; // scattered clouds
  if (conditionCode >= 803) return '\u2601\uFE0F'; // overcast
  return '\u2601\uFE0F';
}

/** Format day of week from date string */
function formatDay(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } catch {
    return dateStr;
  }
}

export interface WeatherWidgetData {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    description: string;
    icon: string;
    conditionCode: number;
  };
  location: {
    name: string;
    country: string;
  };
  forecast?: Array<{
    date: string;
    temp: number;
    tempMin: number;
    tempMax: number;
    description: string;
    icon: string;
    conditionCode: number;
  }>;
}

export interface WeatherWidgetProps {
  /** City name (e.g., "New York" or "London,UK") */
  location?: string;
  /** Temperature units: 'metric' (Celsius) or 'imperial' (Fahrenheit) */
  units?: 'metric' | 'imperial';
  /** Visual theme */
  theme?: 'dark' | 'light' | 'auto';
  /** Auto-refresh interval in minutes */
  refreshInterval?: number;
  /** Pre-loaded weather data (skips API fetch) */
  data?: WeatherWidgetData | null;
  /** Show forecast row */
  showForecast?: boolean;
  /** Compact mode for small containers */
  compact?: boolean;
}

/**
 * WeatherWidget — a self-contained weather display component.
 *
 * Used both as an in-dashboard preview and as standalone signage content.
 * All styles are inline so it renders correctly when served as raw HTML.
 */
export default function WeatherWidget({
  location = 'New York',
  units = 'metric',
  theme = 'dark',
  refreshInterval = 30,
  data: externalData = null,
  showForecast = true,
  compact = false,
}: WeatherWidgetProps) {
  const [weatherData, setWeatherData] = useState<WeatherWidgetData | null>(externalData);
  const [loading, setLoading] = useState(!externalData);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark' || (theme === 'auto' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const unitSymbol = units === 'imperial' ? 'F' : 'C';
  const windUnit = units === 'imperial' ? 'mph' : 'm/s';

  const fetchWeather = useCallback(async () => {
    if (externalData) return;
    try {
      setError(null);
      const result = await apiClient.getWeatherData(location, units);
      setWeatherData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load weather data');
    } finally {
      setLoading(false);
    }
  }, [location, units, externalData]);

  useEffect(() => {
    fetchWeather();

    if (!externalData && refreshInterval > 0) {
      const interval = setInterval(fetchWeather, refreshInterval * 60 * 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchWeather, refreshInterval, externalData]);

  // Update from external data prop
  useEffect(() => {
    if (externalData) {
      setWeatherData(externalData);
      setLoading(false);
      setError(null);
    }
  }, [externalData]);

  // Styles
  const bg = isDark
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    : 'linear-gradient(135deg, #e8f4fd 0%, #b8d8f0 50%, #89b4d4 100%)';
  const textColor = isDark ? '#ffffff' : '#1a1a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,46,0.6)';
  const cardBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const containerStyle: React.CSSProperties = {
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: bg,
    color: textColor,
    padding: compact ? '16px' : '32px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '480px',
    margin: '0 auto',
    boxSizing: 'border-box',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#9729;&#65039;</div>
          <div style={{ fontSize: '14px', color: mutedColor }}>Loading weather...</div>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#9888;&#65039;</div>
          <div style={{ fontSize: '14px', color: mutedColor }}>
            {error || 'Weather service not configured'}
          </div>
          <div style={{ fontSize: '12px', color: mutedColor, marginTop: '8px' }}>
            Set OPENWEATHER_API_KEY to enable live weather
          </div>
        </div>
      </div>
    );
  }

  const { current, location: loc, forecast } = weatherData;

  return (
    <div style={containerStyle} data-testid="weather-widget">
      {/* Location header */}
      <div style={{ textAlign: 'center', marginBottom: compact ? '12px' : '24px' }}>
        <div style={{
          fontSize: compact ? '12px' : '14px',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          color: mutedColor,
        }}>
          {loc.name}
        </div>
        {loc.country && (
          <div style={{ fontSize: '11px', color: mutedColor, opacity: 0.7 }}>
            {loc.country}
          </div>
        )}
      </div>

      {/* Current conditions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? '16px' : '24px',
        marginBottom: compact ? '12px' : '24px',
      }}>
        <div style={{ fontSize: compact ? '48px' : '64px', lineHeight: 1 }}>
          {getWeatherEmoji(current.conditionCode)}
        </div>
        <div>
          <div style={{
            fontSize: compact ? '36px' : '48px',
            fontWeight: 300,
            lineHeight: 1,
          }}>
            {Math.round(current.temp)}&deg;{unitSymbol}
          </div>
          <div style={{
            fontSize: '13px',
            color: mutedColor,
            textTransform: 'capitalize',
            marginTop: '4px',
          }}>
            {current.description}
          </div>
        </div>
      </div>

      {/* Details row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        background: cardBg,
        borderRadius: '12px',
        padding: compact ? '10px' : '16px',
        marginBottom: showForecast && forecast?.length ? (compact ? '12px' : '24px') : '0',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: mutedColor, marginBottom: '4px' }}>Feels like</div>
          <div style={{ fontSize: compact ? '14px' : '18px', fontWeight: 500 }}>
            {Math.round(current.feelsLike)}&deg;
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: mutedColor, marginBottom: '4px' }}>Humidity</div>
          <div style={{ fontSize: compact ? '14px' : '18px', fontWeight: 500 }}>
            {current.humidity}%
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: mutedColor, marginBottom: '4px' }}>Wind</div>
          <div style={{ fontSize: compact ? '14px' : '18px', fontWeight: 500 }}>
            {typeof current.windSpeed === 'number' ? current.windSpeed.toFixed(1) : current.windSpeed} {windUnit}
          </div>
        </div>
      </div>

      {/* Forecast */}
      {showForecast && forecast && forecast.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
          {forecast.slice(0, compact ? 3 : 5).map((day) => (
            <div
              key={day.date}
              style={{
                flex: 1,
                textAlign: 'center',
                background: cardBg,
                borderRadius: '10px',
                padding: compact ? '8px 4px' : '12px 4px',
              }}
            >
              <div style={{ fontSize: '11px', color: mutedColor, marginBottom: '6px' }}>
                {formatDay(day.date)}
              </div>
              <div style={{ fontSize: compact ? '20px' : '28px', marginBottom: '4px' }}>
                {getWeatherEmoji(day.conditionCode)}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {Math.round(day.temp)}&deg;
              </div>
              {!compact && day.tempMin !== undefined && day.tempMax !== undefined && (
                <div style={{ fontSize: '11px', color: mutedColor, marginTop: '2px' }}>
                  {Math.round(day.tempMin)}&deg; / {Math.round(day.tempMax)}&deg;
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
