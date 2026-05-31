//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const {
  buildSecurityHeaderRoutes,
  parseOriginSafe,
} = require('./next.config.security');

const apiOrigin = parseOriginSafe('NEXT_PUBLIC_API_URL');

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
  // by Next.js at build time) - set it to a stable value in production .env.
  experimental: {
    turbopackUseSystemTlsCerts: true,
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
  async headers() {
    return buildSecurityHeaderRoutes();
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
  withBundleAnalyzer,
];

module.exports = composePlugins(...plugins)(nextConfig);
