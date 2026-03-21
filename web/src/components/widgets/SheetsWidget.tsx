'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import type { SheetData } from '@/lib/api/widgets';

export type { SheetData };

export interface SheetsWidgetProps {
  /** Full Google Sheets URL (must be published to web) */
  sheetUrl?: string;
  /** Name of the sheet tab to display */
  sheetName?: string;
  /** Auto-refresh interval in minutes (0 to disable) */
  refreshInterval?: number;
  /** Whether to render the first row as a header */
  showHeader?: boolean;
  /** Alternate row background colors */
  stripedRows?: boolean;
  /** Font size preset for signage viewing distance */
  fontSize?: 'small' | 'medium' | 'large';
  /** Visual theme */
  theme?: 'dark' | 'light' | 'auto';
  /** Compact mode for small containers */
  compact?: boolean;
  /** Optional title displayed above the table */
  title?: string;
  /** Pre-loaded sheet data (skips API fetch) */
  data?: SheetData | null;
}

const FONT_SIZES: Record<string, { header: string; body: string; title: string }> = {
  small:  { header: '13px', body: '12px', title: '16px' },
  medium: { header: '16px', body: '14px', title: '20px' },
  large:  { header: '22px', body: '18px', title: '28px' },
};

/**
 * SheetsWidget -- renders live data from a published Google Sheet as a styled table.
 *
 * All styles are inline so the component works both in the dashboard preview
 * and when served as standalone signage HTML.
 */
export default function SheetsWidget({
  sheetUrl = '',
  sheetName = 'Sheet1',
  refreshInterval = 5,
  showHeader = true,
  stripedRows = true,
  fontSize = 'medium',
  theme = 'dark',
  compact = false,
  title = '',
  data: externalData = null,
}: SheetsWidgetProps) {
  const [sheetData, setSheetData] = useState<SheetData | null>(externalData);
  const [loading, setLoading] = useState(!externalData);
  const [error, setError] = useState<string | null>(null);

  // System dark mode for theme='auto'
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

  const isDark = theme === 'dark' || (theme === 'auto' && systemDark);

  const fetchSheet = useCallback(async () => {
    if (externalData || !sheetUrl) return;
    try {
      setError(null);
      const result = await apiClient.getSheetData(sheetUrl, sheetName);
      setSheetData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load sheet data');
    } finally {
      setLoading(false);
    }
  }, [sheetUrl, sheetName, externalData]);

  useEffect(() => {
    fetchSheet();
    if (!externalData && refreshInterval > 0) {
      const interval = setInterval(fetchSheet, refreshInterval * 60 * 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchSheet, refreshInterval, externalData]);

  useEffect(() => {
    if (externalData) {
      setSheetData(externalData);
      setLoading(false);
      setError(null);
    }
  }, [externalData]);

  // ---- Theme colours ----
  const bg = isDark
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)';
  const textColor   = isDark ? '#ffffff' : '#1e293b';
  const mutedColor  = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(30,41,59,0.55)';
  const headerBg    = isDark ? 'rgba(0,229,160,0.18)' : 'rgba(0,229,160,0.12)';
  const headerColor = isDark ? '#00E5A0' : '#047857';
  const rowEvenBg   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const rowOddBg    = 'transparent';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const sizes = FONT_SIZES[fontSize] || FONT_SIZES.medium;

  const containerStyle: React.CSSProperties = {
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: bg,
    color: textColor,
    padding: compact ? '12px' : '24px',
    borderRadius: '16px',
    width: '100%',
    boxSizing: 'border-box',
    overflow: 'auto',
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div style={containerStyle} data-testid="sheets-widget">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '14px', color: mutedColor }}>Loading sheet data...</div>
        </div>
      </div>
    );
  }

  // ---- Error / empty state ----
  if (error || !sheetData) {
    return (
      <div style={containerStyle} data-testid="sheets-widget">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '14px', color: mutedColor }}>
            {error || (sheetUrl ? 'No data returned' : 'No Sheet URL configured')}
          </div>
          <div style={{ fontSize: '12px', color: mutedColor, marginTop: '8px' }}>
            Paste a published Google Sheets URL to display live data.
          </div>
        </div>
      </div>
    );
  }

  const { headers, rows } = sheetData;

  return (
    <div style={containerStyle} data-testid="sheets-widget">
      {title && (
        <div style={{
          fontSize: sizes.title,
          fontWeight: 700,
          marginBottom: compact ? '8px' : '16px',
          textAlign: 'center',
          letterSpacing: '0.5px',
        }}>
          {title}
        </div>
      )}

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: sizes.body,
      }}>
        {showHeader && headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: compact ? '6px 8px' : '10px 14px',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: sizes.header,
                    color: headerColor,
                    background: headerBg,
                    borderBottom: `2px solid ${borderColor}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{
                background: stripedRows && ri % 2 === 0 ? rowEvenBg : rowOddBg,
              }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: compact ? '5px 8px' : '8px 14px',
                    borderBottom: `1px solid ${borderColor}`,
                  }}
                >
                  {cell != null ? String(cell) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        fontSize: '11px',
        color: mutedColor,
        textAlign: 'right',
        marginTop: compact ? '6px' : '12px',
      }}>
        {rows.length} row{rows.length !== 1 ? 's' : ''} &middot; Updated {new Date(sheetData.fetchedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}
