'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SocialPlatform = 'instagram' | 'twitter' | 'tiktok' | 'linkedin' | 'other';

export interface SocialPost {
  url: string;
  platform: SocialPlatform;
  caption?: string;
}

export interface SocialFeedWidgetProps {
  /** Array of social media post objects (url + optional platform/caption). */
  posts?: SocialPost[];
  /** Seconds between automatic card transitions (default 10). */
  rotateInterval?: number;
  /** Show a platform icon on each card (default true). */
  showPlatformIcon?: boolean;
  /** Visual theme (default 'dark'). */
  theme?: 'dark' | 'light' | 'auto';
  /** Compact mode for small containers. */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Platform detection & branding
// ---------------------------------------------------------------------------

export function detectPlatform(url: string): SocialPlatform {
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('linkedin.com')) return 'linkedin';
  return 'other';
}

interface PlatformMeta {
  label: string;
  color: string;
  /** CSS gradient or solid background for the card accent. */
  gradient: string;
  /** Simple SVG path icon (24x24 viewBox). */
  iconPath: string;
}

const PLATFORM_META: Record<SocialPlatform, PlatformMeta> = {
  instagram: {
    label: 'Instagram',
    color: '#E1306C',
    gradient: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
    iconPath:
      'M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.97.24 2.43.403a4.08 4.08 0 011.47.958c.46.46.753.906.958 1.47.163.46.35 1.26.403 2.43.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.24 1.97-.403 2.43a4.08 4.08 0 01-.958 1.47 4.08 4.08 0 01-1.47.958c-.46.163-1.26.35-2.43.403-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.97-.24-2.43-.403a4.08 4.08 0 01-1.47-.958 4.08 4.08 0 01-.958-1.47c-.163-.46-.35-1.26-.403-2.43C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.054-1.17.24-1.97.403-2.43a4.08 4.08 0 01.958-1.47 4.08 4.08 0 011.47-.958c.46-.163 1.26-.35 2.43-.403C8.416 2.175 8.796 2.163 12 2.163M12 0C8.741 0 8.333.014 7.053.072 5.775.13 4.902.333 4.14.63a5.88 5.88 0 00-2.126 1.384A5.88 5.88 0 00.63 4.14C.333 4.902.13 5.775.072 7.053.014 8.333 0 8.741 0 12s.014 3.667.072 4.947c.058 1.278.261 2.15.558 2.913a5.88 5.88 0 001.384 2.126A5.88 5.88 0 004.14 23.37c.763.297 1.635.5 2.913.558C8.333 23.986 8.741 24 12 24s3.667-.014 4.947-.072c1.278-.058 2.15-.261 2.913-.558a5.88 5.88 0 002.126-1.384 5.88 5.88 0 001.384-2.126c.297-.763.5-1.635.558-2.913.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.058-1.278-.261-2.15-.558-2.913a5.88 5.88 0 00-1.384-2.126A5.88 5.88 0 0019.86.63C19.097.333 18.225.13 16.947.072 15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  twitter: {
    label: 'X (Twitter)',
    color: '#000000',
    gradient: 'linear-gradient(135deg, #15202B, #1DA1F2)',
    iconPath:
      'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  tiktok: {
    label: 'TikTok',
    color: '#000000',
    gradient: 'linear-gradient(135deg, #000000, #25F4EE, #FE2C55)',
    iconPath:
      'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.55a8.24 8.24 0 004.77 1.52V6.69h-1z',
  },
  linkedin: {
    label: 'LinkedIn',
    color: '#0077B5',
    gradient: 'linear-gradient(135deg, #0077B5, #00A0DC)',
    iconPath:
      'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
  other: {
    label: 'Social',
    color: '#6B7280',
    gradient: 'linear-gradient(135deg, #4B5563, #6B7280)',
    iconPath:
      'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a display-friendly handle or path from a social URL. */
function extractHandle(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      // For instagram/twitter style: /@user or /user
      return segments[0].replace(/^@/, '@') || u.hostname;
    }
    return u.hostname;
  } catch {
    return url;
  }
}

/** Parse a textarea value (newline-separated URLs) into SocialPost[]. */
export function parsePostUrls(text: string): SocialPost[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((url) => ({
      url,
      platform: detectPlatform(url),
    }));
}

// ---------------------------------------------------------------------------
// Platform icon sub-component
// ---------------------------------------------------------------------------

function PlatformIcon({
  platform,
  size = 24,
}: {
  platform: SocialPlatform;
  size?: number;
}) {
  const meta = PLATFORM_META[platform];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={meta.color === '#000000' ? 'currentColor' : meta.color}
      aria-label={meta.label}
      role="img"
    >
      <path d={meta.iconPath} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SocialFeedWidget({
  posts = [],
  rotateInterval = 10,
  showPlatformIcon = true,
  theme = 'dark',
  compact = false,
}: SocialFeedWidgetProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Track system dark mode preference for theme='auto'
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

  // Auto-rotate
  const advance = useCallback(() => {
    if (posts.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % posts.length);
  }, [posts.length]);

  useEffect(() => {
    if (posts.length <= 1 || rotateInterval <= 0) return;
    const id = setInterval(advance, rotateInterval * 1000);
    return () => clearInterval(id);
  }, [advance, rotateInterval, posts.length]);

  // Keep index in bounds when posts change
  useEffect(() => {
    if (posts.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= posts.length) {
      setActiveIndex(0);
    }
  }, [posts.length, activeIndex]);

  // ------ Styles ------
  const textColor = isDark ? '#ffffff' : '#1a1a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,26,46,0.55)';
  const surfaceBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const containerBg = isDark
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)';

  const containerStyle: React.CSSProperties = {
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: containerBg,
    color: textColor,
    padding: compact ? '16px' : '24px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '480px',
    margin: '0 auto',
    boxSizing: 'border-box',
    overflow: 'hidden',
  };

  // ------ Empty state ------
  if (posts.length === 0) {
    return (
      <div style={containerStyle} data-testid="social-feed-widget">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#128279;</div>
          <div style={{ fontSize: '14px', color: mutedColor }}>
            No social media posts configured
          </div>
          <div style={{ fontSize: '12px', color: mutedColor, marginTop: '8px' }}>
            Add post URLs to display a social feed
          </div>
        </div>
      </div>
    );
  }

  const post = posts[activeIndex];
  const meta = PLATFORM_META[post.platform];

  return (
    <div style={containerStyle} data-testid="social-feed-widget">
      {/* Post card */}
      <div
        style={{
          background: surfaceBg,
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {/* Accent bar with platform gradient */}
        <div
          style={{
            height: '4px',
            background: meta.gradient,
          }}
        />

        <div style={{ padding: compact ? '12px' : '20px' }}>
          {/* Header: platform icon + label + handle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: compact ? '8px' : '14px',
            }}
          >
            {showPlatformIcon && (
              <div
                style={{
                  width: compact ? '32px' : '40px',
                  height: compact ? '32px' : '40px',
                  borderRadius: '50%',
                  background: meta.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#ffffff',
                }}
              >
                <PlatformIcon
                  platform={post.platform}
                  size={compact ? 16 : 20}
                />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: compact ? '13px' : '15px',
                  fontWeight: 600,
                }}
              >
                {meta.label}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: mutedColor,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {extractHandle(post.url)}
              </div>
            </div>
          </div>

          {/* Caption / URL */}
          <div
            style={{
              fontSize: compact ? '13px' : '15px',
              lineHeight: 1.5,
              color: textColor,
              wordBreak: 'break-word',
            }}
          >
            {post.caption || post.url}
          </div>

          {/* Link to original */}
          <div style={{ marginTop: compact ? '8px' : '14px' }}>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                fontSize: '12px',
                color: meta.color === '#000000' ? (isDark ? '#1DA1F2' : '#0077B5') : meta.color,
                textDecoration: 'none',
              }}
            >
              View on {meta.label} &#8599;
            </a>
          </div>
        </div>
      </div>

      {/* Pagination dots */}
      {posts.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            marginTop: compact ? '10px' : '16px',
          }}
        >
          {posts.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              aria-label={`Go to post ${idx + 1}`}
              style={{
                width: idx === activeIndex ? '20px' : '8px',
                height: '8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s',
                background:
                  idx === activeIndex
                    ? meta.color === '#000000'
                      ? isDark
                        ? '#1DA1F2'
                        : '#333333'
                      : meta.color
                    : isDark
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(0,0,0,0.15)',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
