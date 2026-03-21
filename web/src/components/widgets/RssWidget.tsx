'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import type { RssFeedData, RssFeedItem } from '@/lib/api/widgets';

export interface RssWidgetProps {
  /** RSS or Atom feed URL */
  feedUrl?: string;
  /** Maximum number of items to display */
  maxItems?: number;
  /** Show thumbnail images if available */
  showImages?: boolean;
  /** Show article summary/description */
  showSummary?: boolean;
  /** Auto-scroll speed for signage display */
  scrollSpeed?: 'slow' | 'medium' | 'fast' | 'none';
  /** Auto-refresh interval in minutes */
  refreshInterval?: number;
  /** Visual theme */
  theme?: 'dark' | 'light' | 'auto';
  /** Compact mode for small containers */
  compact?: boolean;
  /** Pre-loaded feed data (skips API fetch) */
  data?: RssFeedData | null;
}

/** Convert a date string to a relative time label (e.g. "2h ago") */
function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return '';
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/** Truncate a string to a maximum character count */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

/**
 * RssWidget — displays headlines from an RSS or Atom feed.
 *
 * Used both as an in-dashboard preview and as standalone signage content.
 * All styles are inline so it renders correctly when served as raw HTML.
 */
export default function RssWidget({
  feedUrl = '',
  maxItems = 10,
  showImages = true,
  showSummary = true,
  scrollSpeed = 'slow',
  refreshInterval = 15,
  theme = 'dark',
  compact = false,
  data: externalData = null,
}: RssWidgetProps) {
  const [feedData, setFeedData] = useState<RssFeedData | null>(externalData);
  const [loading, setLoading] = useState(!externalData);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Track system dark mode preference
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

  const fetchFeed = useCallback(async () => {
    if (externalData || !feedUrl) return;
    try {
      setError(null);
      const result = await apiClient.getRssFeed(feedUrl, maxItems);
      setFeedData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load RSS feed');
    } finally {
      setLoading(false);
    }
  }, [feedUrl, maxItems, externalData]);

  useEffect(() => {
    fetchFeed();

    if (!externalData && feedUrl && refreshInterval > 0) {
      const interval = setInterval(fetchFeed, refreshInterval * 60 * 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchFeed, refreshInterval, externalData, feedUrl]);

  // Update from external data prop
  useEffect(() => {
    if (externalData) {
      setFeedData(externalData);
      setLoading(false);
      setError(null);
    }
  }, [externalData]);

  // Auto-scroll effect
  useEffect(() => {
    if (scrollSpeed === 'none' || !scrollRef.current) return;

    const speedMap = { slow: 0.3, medium: 0.8, fast: 1.5 };
    const px = speedMap[scrollSpeed] || 0.3;
    const el = scrollRef.current;

    let running = true;
    const scroll = () => {
      if (!running || !el) return;
      el.scrollTop += px;
      // Loop back to top when reaching the end
      if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
        el.scrollTop = 0;
      }
      animFrameRef.current = requestAnimationFrame(scroll);
    };
    animFrameRef.current = requestAnimationFrame(scroll);

    return () => {
      running = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [scrollSpeed, feedData]);

  // Style tokens
  const bg = isDark
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    : 'linear-gradient(135deg, #fafafa 0%, #f0f0f0 50%, #e8e8e8 100%)';
  const textColor = isDark ? '#ffffff' : '#1a1a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,26,46,0.55)';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const accentColor = '#f97316'; // orange for RSS

  const containerStyle: React.CSSProperties = {
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: bg,
    color: textColor,
    padding: compact ? '16px' : '24px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '520px',
    margin: '0 auto',
    boxSizing: 'border-box',
    overflow: 'hidden',
  };

  if (!feedUrl && !externalData) {
    return (
      <div style={containerStyle} data-testid="rss-widget">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#128240;</div>
          <div style={{ fontSize: '14px', color: mutedColor }}>
            No feed URL configured
          </div>
          <div style={{ fontSize: '12px', color: mutedColor, marginTop: '8px' }}>
            Enter an RSS or Atom feed URL to display headlines
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={containerStyle} data-testid="rss-widget">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '14px', color: mutedColor }}>Loading feed...</div>
          {/* Skeleton items */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: cardBg,
                borderRadius: '8px',
                height: compact ? '48px' : '64px',
                margin: '8px 0',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !feedData) {
    return (
      <div style={containerStyle} data-testid="rss-widget">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#9888;&#65039;</div>
          <div style={{ fontSize: '14px', color: mutedColor }}>
            {error || 'Failed to load feed'}
          </div>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchFeed();
            }}
            style={{
              marginTop: '12px',
              padding: '8px 20px',
              border: `1px solid ${accentColor}`,
              borderRadius: '8px',
              background: 'transparent',
              color: accentColor,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { feedTitle, items } = feedData;
  const displayItems = items.slice(0, maxItems);

  return (
    <div style={containerStyle} data-testid="rss-widget">
      {/* Feed title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: compact ? '12px' : '18px',
          paddingBottom: compact ? '8px' : '12px',
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
          }}
        >
          &#128240;
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: compact ? '14px' : '16px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {feedTitle}
          </div>
          <div style={{ fontSize: '11px', color: mutedColor }}>
            {displayItems.length} article{displayItems.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Items list */}
      <div
        ref={scrollRef}
        style={{
          maxHeight: compact ? '280px' : '420px',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {displayItems.map((item: RssFeedItem, idx: number) => (
          <div
            key={`${item.link || idx}`}
            style={{
              display: 'flex',
              gap: '12px',
              padding: compact ? '8px 0' : '12px 0',
              borderBottom:
                idx < displayItems.length - 1
                  ? `1px solid ${borderColor}`
                  : 'none',
              alignItems: 'flex-start',
            }}
          >
            {/* Thumbnail */}
            {showImages && item.imageUrl && (
              <div
                style={{
                  width: compact ? '48px' : '64px',
                  height: compact ? '48px' : '64px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: cardBg,
                }}
              >
                <img
                  src={item.imageUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: compact ? '13px' : '15px',
                  fontWeight: 600,
                  lineHeight: 1.35,
                  marginBottom: '4px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {item.title}
              </div>

              {showSummary && item.description && (
                <div
                  style={{
                    fontSize: compact ? '11px' : '13px',
                    color: mutedColor,
                    lineHeight: 1.4,
                    marginBottom: '4px',
                    display: '-webkit-box',
                    WebkitLineClamp: compact ? 1 : 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {truncate(item.description, compact ? 80 : 150)}
                </div>
              )}

              {item.pubDate && (
                <div
                  style={{
                    fontSize: '11px',
                    color: accentColor,
                    fontWeight: 500,
                  }}
                >
                  {relativeTime(item.pubDate)}
                </div>
              )}
            </div>
          </div>
        ))}

        {displayItems.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 0',
              color: mutedColor,
              fontSize: '13px',
            }}
          >
            No articles found in this feed
          </div>
        )}
      </div>
    </div>
  );
}
