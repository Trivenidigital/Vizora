'use client';

import { useState, useEffect } from 'react';

export interface ClockWidgetProps {
  /** Display mode: clock shows current time, countdown counts down to a target */
  mode?: 'clock' | 'countdown';
  /** Time format: 12-hour or 24-hour */
  format?: '12h' | '24h';
  /** Show the current date below the time (clock mode) */
  showDate?: boolean;
  /** Show seconds in the display */
  showSeconds?: boolean;
  /** IANA timezone (e.g. "America/New_York") or "local" for device timezone */
  timezone?: string;
  /** Target date/time for countdown mode (ISO 8601 or "YYYY-MM-DD HH:MM") */
  targetDate?: string;
  /** Event name displayed above countdown */
  eventName?: string;
  /** Visual theme */
  theme?: 'dark' | 'light' | 'auto';
  /** Compact mode for small containers / preview */
  compact?: boolean;
}

/**
 * ClockWidget — displays current time or countdown to an event.
 *
 * Fully client-side (no API calls). Uses Intl.DateTimeFormat for timezone support.
 * All styles are inline so it renders correctly as standalone signage content.
 */
export default function ClockWidget({
  mode = 'clock',
  format = '12h',
  showDate = true,
  showSeconds = true,
  timezone = 'local',
  targetDate = '',
  eventName = '',
  theme = 'dark',
  compact = false,
}: ClockWidgetProps) {
  const [now, setNow] = useState(() => new Date());

  // Track system dark mode preference reactively (for theme='auto')
  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isDark = theme === 'dark' || (theme === 'auto' && systemDark);

  // Resolve timezone — "local" or empty means device timezone (undefined for Intl)
  const tz = timezone && timezone !== 'local' ? timezone : undefined;

  // Theme colors
  const bg = isDark
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    : 'linear-gradient(135deg, #f0f0f8 0%, #dde4ee 50%, #c8d4e4 100%)';
  const textColor = isDark ? '#ffffff' : '#1a1a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,26,46,0.55)';
  const accentColor = isDark ? '#00E5A0' : '#0f3460';
  const cardBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const monoFont = "var(--font-mono, 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace)";

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
    textAlign: 'center',
  };

  // ─── Clock Mode ───────────────────────────────────────────
  if (mode === 'clock') {
    return (
      <div style={containerStyle} data-testid="clock-widget">
        {renderClockDisplay()}
      </div>
    );
  }

  // ─── Countdown Mode ───────────────────────────────────────
  return (
    <div style={containerStyle} data-testid="clock-widget-countdown">
      {renderCountdownDisplay()}
    </div>
  );

  // ─── Clock Renderer ───────────────────────────────────────
  function renderClockDisplay() {
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      ...(showSeconds ? { second: '2-digit' } : {}),
      hour12: format === '12h',
      ...(tz ? { timeZone: tz } : {}),
    };

    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(tz ? { timeZone: tz } : {}),
    };

    let timeStr: string;
    let dateStr: string;
    try {
      timeStr = now.toLocaleTimeString('en-US', timeOptions);
      dateStr = now.toLocaleDateString('en-US', dateOptions);
    } catch {
      // Fallback if invalid timezone
      timeStr = now.toLocaleTimeString('en-US', { ...timeOptions, timeZone: undefined });
      dateStr = now.toLocaleDateString('en-US', { ...dateOptions, timeZone: undefined });
    }

    // Split time into main part and period (AM/PM) for styling
    const parts = timeStr.split(' ');
    const timePart = parts[0];
    const period = parts.length > 1 ? parts[1] : '';

    return (
      <>
        {/* Timezone label */}
        {tz && (
          <div style={{
            fontSize: compact ? '10px' : '12px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: mutedColor,
            marginBottom: '8px',
          }}>
            {tz.replace(/_/g, ' ')}
          </div>
        )}

        {/* Time display */}
        <div style={{
          fontSize: compact ? '42px' : '64px',
          fontFamily: monoFont,
          fontWeight: 300,
          lineHeight: 1.1,
          letterSpacing: '-1px',
          marginBottom: showDate ? '12px' : '0',
        }}>
          {timePart}
          {period && (
            <span style={{
              fontSize: compact ? '16px' : '24px',
              fontWeight: 400,
              marginLeft: '6px',
              color: accentColor,
              verticalAlign: 'super',
            }}>
              {period}
            </span>
          )}
        </div>

        {/* Date display */}
        {showDate && (
          <div style={{
            fontSize: compact ? '12px' : '16px',
            color: mutedColor,
            fontWeight: 400,
          }}>
            {dateStr}
          </div>
        )}
      </>
    );
  }

  // ─── Countdown Renderer ───────────────────────────────────
  function renderCountdownDisplay() {
    const target = parseTargetDate(targetDate);

    if (!target) {
      return (
        <div style={{ padding: compact ? '16px 0' : '32px 0' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>&#9202;</div>
          <div style={{ fontSize: '14px', color: mutedColor }}>
            Set a target date to start the countdown
          </div>
        </div>
      );
    }

    const diff = target.getTime() - now.getTime();
    const finished = diff <= 0;

    if (finished) {
      return (
        <>
          {eventName && (
            <div style={{
              fontSize: compact ? '14px' : '18px',
              color: accentColor,
              fontWeight: 600,
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              {eventName}
            </div>
          )}
          <div style={{
            fontSize: compact ? '28px' : '42px',
            fontWeight: 600,
            color: accentColor,
            marginBottom: '8px',
          }}>
            Event Started!
          </div>
          <div style={{ fontSize: '14px', color: mutedColor }}>
            {target.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </>
      );
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const units = [
      { value: days, label: 'Days' },
      { value: hours, label: 'Hours' },
      { value: minutes, label: 'Minutes' },
      { value: seconds, label: 'Seconds' },
    ];

    const digitSize = compact ? '32px' : '48px';
    const labelSize = compact ? '9px' : '11px';
    const separatorSize = compact ? '24px' : '36px';

    return (
      <>
        {/* Event name */}
        {eventName && (
          <div style={{
            fontSize: compact ? '12px' : '16px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: accentColor,
            fontWeight: 600,
            marginBottom: compact ? '12px' : '20px',
          }}>
            {eventName}
          </div>
        )}

        {/* Countdown digits */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: compact ? '6px' : '12px',
        }}>
          {units.map((unit, i) => (
            <div key={unit.label} style={{ display: 'flex', alignItems: 'flex-start', gap: compact ? '6px' : '12px' }}>
              <div style={{
                background: cardBg,
                borderRadius: compact ? '8px' : '12px',
                padding: compact ? '8px 10px' : '14px 18px',
                minWidth: compact ? '48px' : '72px',
              }}>
                <div style={{
                  fontSize: digitSize,
                  fontFamily: monoFont,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  letterSpacing: '-1px',
                }}>
                  {String(unit.value).padStart(2, '0')}
                </div>
                <div style={{
                  fontSize: labelSize,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: mutedColor,
                  marginTop: '4px',
                }}>
                  {unit.label}
                </div>
              </div>
              {i < units.length - 1 && (
                <div style={{
                  fontSize: separatorSize,
                  fontFamily: monoFont,
                  fontWeight: 300,
                  color: mutedColor,
                  lineHeight: 1.4,
                  paddingTop: compact ? '8px' : '14px',
                }}>
                  :
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Target date */}
        <div style={{
          fontSize: compact ? '10px' : '12px',
          color: mutedColor,
          marginTop: compact ? '12px' : '20px',
        }}>
          Target: {target.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          {' '}
          {target.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </div>
      </>
    );
  }
}

/** Parse various date formats into a Date object */
function parseTargetDate(input: string): Date | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim();

  // Try "YYYY-MM-DD HH:MM" format
  const shortMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})$/);
  if (shortMatch) {
    const d = new Date(`${shortMatch[1]}T${shortMatch[2]}:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Try ISO 8601 and other standard formats
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}
