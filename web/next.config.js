//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

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
  webpack: (config) => {
    config.devtool = false;
    return config;
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
      // Proxy uploaded content files through Next.js
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
  // Security headers
  async headers() {
    const cspBackendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const realtimeUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002';
    return [
      // Relaxed CSP for /display route — needs iframes, external media, WebSocket
      {
        source: '/display',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${cspBackendUrl} https: http:; font-src 'self' data:; connect-src 'self' ${cspBackendUrl} ${realtimeUrl} ws: wss: https: http:; media-src 'self' blob: ${cspBackendUrl} https: http:; frame-src 'self' https: http:;`,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/((?!display).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: ${cspBackendUrl} https:; font-src 'self' data:; connect-src 'self' ${cspBackendUrl} ws: wss: https:; media-src 'self' ${cspBackendUrl};`,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
