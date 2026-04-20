//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// URL parsing with validation — malformed env values become CSP header-injection
// vectors if passed through raw. Returns null on empty / invalid.
function parseOriginSafe(envVar) {
  const v = process.env[envVar];
  if (!v) return null;
  try {
    return new URL(v).origin;
  } catch {
    throw new Error(
      `Invalid ${envVar}: "${v}" is not a valid URL. Refusing to build (would inject unvalidated text into CSP header).`,
    );
  }
}

const apiOrigin = parseOriginSafe('NEXT_PUBLIC_API_URL');
const socketOrigin = parseOriginSafe('NEXT_PUBLIC_SOCKET_URL');
const socketWsOrigin = socketOrigin ? socketOrigin.replace(/^http/, 'ws') : null; // http→ws, https→wss

// Build-time guard: production must have a socket origin. Without it, the CSP
// connect-src previously fell back to bare scheme wildcards (ws:/wss:/https:)
// which is effectively `connect-src *` for realtime traffic.
if (process.env.NODE_ENV === 'production' && !socketOrigin) {
  throw new Error(
    'NEXT_PUBLIC_SOCKET_URL must be set in production — refusing to build a permissive CSP.',
  );
}

// Staging is production-adjacent: any NODE_ENV value that isn't exactly
// 'development' should NOT get loopback sources in the CSP. Prevents
// devSources bleed-through on staging.
const isDev = process.env.NODE_ENV === 'development';
const devSources = isDev ? 'http://localhost:3000 http://localhost:3002 ws://localhost:3002' : '';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  typescript: {
    ignoreBuildErrors: false,
  },
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  // Allow Server Actions from production and dev origins.
  // The actual fix for "Failed to find Server Action" errors on rebuild
  // is the NEXT_SERVER_ACTIONS_ENCRYPTION_KEY env var (read automatically
  // by Next.js at build time) — set it to a stable value in production .env.
  experimental: {
    serverActions: {
      allowedOrigins: ['vizora.cloud', 'www.vizora.cloud', 'localhost:3001'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/static/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
      // Production: use validated apiOrigin (parseOriginSafe above). If
      // NEXT_PUBLIC_API_URL is unset or malformed, this simply empties out —
      // local Next.js rewrites still proxy to the middleware same-origin.
      ...(apiOrigin
        ? [
            {
              protocol: new URL(apiOrigin).protocol.replace(':', ''),
              hostname: new URL(apiOrigin).hostname,
              pathname: '/static/**',
            },
            {
              protocol: new URL(apiOrigin).protocol.replace(':', ''),
              hostname: new URL(apiOrigin).hostname,
              pathname: '/api/**',
            },
          ]
        : []),
    ],
  },
  webpack: (config) => {
    config.devtool = false;
    return config;
  },
  async redirects() {
    return [
      { source: '/pricing', destination: '/#pricing', permanent: false },
    ];
  },
  // Proxy API requests through Next.js to the backend.
  // This makes cookies same-origin (both on port 3001) so httpOnly auth
  // cookies set by the backend are visible to Next.js middleware.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      // Backwards compatibility: redirect old /api/ to /api/v1/
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      // Proxy static files (thumbnails) through Next.js so they're same-origin
      {
        source: '/static/:path*',
        destination: `${backendUrl}/static/:path*`,
      },
      // Proxy template seed thumbnails through Next.js
      {
        source: '/templates/seed/:path*',
        destination: `${backendUrl}/templates/seed/:path*`,
      },
      // Proxy uploaded content files through Next.js
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
  // Security headers
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';

    // Base security headers — applied to all routes. Immutable array: isProd
    // splice via spread (avoids mutation-of-referenced-array footgun).
    const baseSecurityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        // Added payment, usb, display-capture for a signage platform —
        // display clients have no need for any of these, and disabling them
        // shrinks the surface for compromised content.
        value:
          'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), display-capture=()',
      },
    ];
    const commonSecurityHeaders = isProd
      ? [
          ...baseSecurityHeaders,
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ]
      : baseSecurityHeaders;

    // Build connect-src with validated origins only. No bare scheme wildcards
    // (`ws:`, `wss:`, `https:`) in prod — those defeated the tightening.
    const connectSrcParts = ['\'self\''];
    if (socketOrigin) connectSrcParts.push(socketOrigin);
    if (socketWsOrigin) connectSrcParts.push(socketWsOrigin);
    if (devSources) connectSrcParts.push(devSources);

    const displayCsp = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline'`, // NOTE: unsafe-inline is accepted risk; nonce-based CSP is a follow-up PR
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: https: ${devSources}`,
      `font-src 'self' data:`,
      `connect-src ${[...connectSrcParts, 'https://accounts.google.com'].join(' ')}`,
      `media-src 'self' blob: https: ${devSources}`,
      `frame-src 'self' https:`,
      // Display pages run on TV/kiosk screens — they should never be embedded
      // in another context, have a different base URI, or submit forms.
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'none'`,
    ]
      .filter(Boolean)
      .join('; ');

    const dashboardCsp = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com`, // NOTE: unsafe-inline is accepted risk; nonce-based CSP is a follow-up PR
      `style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com`,
      `img-src 'self' data: blob: https: ${devSources}`,
      `font-src 'self' data: https://fonts.gstatic.com`,
      `connect-src ${[...connectSrcParts, 'https://accounts.google.com'].join(' ')}`,
      `frame-src 'self' https://accounts.google.com`,
      `media-src 'self' blob: ${devSources}`,
      `frame-ancestors 'self'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ]
      .filter(Boolean)
      .join('; ');

    return [
      {
        source: '/display',
        headers: [
          { key: 'Content-Security-Policy', value: displayCsp },
          ...commonSecurityHeaders,
        ],
      },
      {
        source: '/((?!display).*)',
        headers: [
          { key: 'Content-Security-Policy', value: dashboardCsp },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          ...commonSecurityHeaders,
        ],
      },
    ];
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
  withBundleAnalyzer,
];

module.exports = composePlugins(...plugins)(nextConfig);
