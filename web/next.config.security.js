function parseOriginSafe(envVar, value = process.env[envVar]) {
  if (!value) return null;

  try {
    if (/\s/.test(value)) {
      throw new Error('URL contains whitespace');
    }

    const parsed = new URL(value);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol) || parsed.origin === 'null') {
      throw new Error(`unsupported protocol ${parsed.protocol}`);
    }

    return parsed.origin;
  } catch {
    throw new Error(
      `Invalid ${envVar}: "${value}" is not a valid URL. Refusing to build because it would inject unvalidated text into CSP headers.`,
    );
  }
}

function toWebSocketOrigin(origin) {
  if (!origin) return null;
  if (origin.startsWith('https://')) return origin.replace(/^https:\/\//, 'wss://');
  if (origin.startsWith('http://')) return origin.replace(/^http:\/\//, 'ws://');
  return origin.startsWith('ws://') || origin.startsWith('wss://') ? origin : null;
}

function joinCsp(directives) {
  return directives
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('; ');
}

function buildSecurityHeaderRoutes(env = process.env) {
  const nodeEnv = env.nodeEnv ?? env.NODE_ENV;
  const isProd = nodeEnv === 'production';
  const isDev = nodeEnv === 'development';
  const socketOrigin = parseOriginSafe('NEXT_PUBLIC_SOCKET_URL', env.socketUrl ?? env.NEXT_PUBLIC_SOCKET_URL);
  const apiOrigin = parseOriginSafe('NEXT_PUBLIC_API_URL', env.apiUrl ?? env.NEXT_PUBLIC_API_URL);

  if (isProd && !socketOrigin) {
    throw new Error(
      'NEXT_PUBLIC_SOCKET_URL must be set in production so web CSP connect-src is not permissive or broken.',
    );
  }

  const socketWsOrigin = toWebSocketOrigin(socketOrigin);
  const devSources = isDev
    ? 'http://localhost:3000 http://localhost:3002 ws://localhost:3002'
    : '';
  const connectSources = ["'self'"];

  if (socketOrigin) connectSources.push(socketOrigin);
  if (socketWsOrigin && socketWsOrigin !== socketOrigin) connectSources.push(socketWsOrigin);
  if (apiOrigin && !connectSources.includes(apiOrigin)) connectSources.push(apiOrigin);
  if (devSources) connectSources.push(devSources);

  const baseSecurityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
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

  const displayCsp = joinCsp([
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${apiOrigin ?? ''} ${devSources}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    `media-src 'self' blob: https: ${apiOrigin ?? ''} ${devSources}`,
    "frame-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ]);

  const dashboardCsp = joinCsp([
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com",
    `img-src 'self' data: blob: https: ${apiOrigin ?? ''} ${devSources}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${[...connectSources, 'https://accounts.google.com'].join(' ')}`,
    "frame-src 'self' https://accounts.google.com",
    `media-src 'self' blob: https: ${apiOrigin ?? ''} ${devSources}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ]);

  return [
    {
      source: '/display/:path*',
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
}

module.exports = {
  buildSecurityHeaderRoutes,
  parseOriginSafe,
  toWebSocketOrigin,
};
