const {
  buildSecurityHeaderRoutes,
  parseOriginSafe,
} = require('./next.config.security');

describe('next.config security headers', () => {
  it('rejects malformed public URL values before they reach CSP headers', () => {
    expect(() => parseOriginSafe('NEXT_PUBLIC_SOCKET_URL', 'https://vizora.cloud\nbad')).toThrow(
      /Invalid NEXT_PUBLIC_SOCKET_URL/,
    );
  });

  it('builds production CSP without localhost, raw backend URLs, or deprecated XSS headers', () => {
    const routes = buildSecurityHeaderRoutes({
      nodeEnv: 'production',
      socketUrl: 'https://rt.vizora.example',
    });

    const allHeaders = routes.flatMap(route => route.headers);
    const headerText = allHeaders.map(header => `${header.key}: ${header.value}`).join('\n');

    expect(headerText).toContain('Strict-Transport-Security');
    expect(headerText).toContain('Permissions-Policy');
    expect(headerText).toContain('wss://rt.vizora.example');
    expect(headerText).not.toContain('localhost');
    expect(headerText).not.toContain('http://localhost:3000');
    expect(headerText).not.toContain('X-XSS-Protection');
  });

  it('requires an explicit realtime origin for production builds', () => {
    expect(() => buildSecurityHeaderRoutes({ nodeEnv: 'production' })).toThrow(
      /NEXT_PUBLIC_SOCKET_URL must be set in production/,
    );
  });

  it('rejects localhost public origins in production builds', () => {
    expect(() =>
      buildSecurityHeaderRoutes({
        nodeEnv: 'production',
        socketUrl: 'http://localhost:3002',
      }),
    ).toThrow(/NEXT_PUBLIC_SOCKET_URL must not use a localhost or loopback origin in production/);

    expect(() =>
      buildSecurityHeaderRoutes({
        nodeEnv: 'production',
        socketUrl: 'https://rt.vizora.example',
        apiUrl: 'http://127.0.0.1:3000',
      }),
    ).toThrow(/NEXT_PUBLIC_API_URL must not use a localhost or loopback origin in production/);
  });

  it('does not leak ambient process env into explicit env-object production checks', () => {
    const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;
    const previousSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_SOCKET_URL = 'http://localhost:3002';

    try {
      const routes = buildSecurityHeaderRoutes({
        nodeEnv: 'production',
        socketUrl: 'https://rt.vizora.example',
      });

      const headerText = routes
        .flatMap(route => route.headers)
        .map(header => `${header.key}: ${header.value}`)
        .join('\n');

      expect(headerText).not.toContain('localhost');
    } finally {
      if (previousApiUrl === undefined) {
        delete process.env.NEXT_PUBLIC_API_URL;
      } else {
        process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
      }

      if (previousSocketUrl === undefined) {
        delete process.env.NEXT_PUBLIC_SOCKET_URL;
      } else {
        process.env.NEXT_PUBLIC_SOCKET_URL = previousSocketUrl;
      }
    }
  });

  it('allows display clients to fetch protected content from the public API origin', () => {
    const routes = buildSecurityHeaderRoutes({
      nodeEnv: 'production',
      socketUrl: 'https://rt.vizora.example',
      apiUrl: 'https://api.vizora.example',
    });

    const displayRoute = routes.find(route => route.source === '/display/:path*');
    const displayCsp = displayRoute.headers.find(header => header.key === 'Content-Security-Policy').value;

    expect(displayCsp).toContain('connect-src');
    expect(displayCsp).toContain('media-src');
    expect(displayCsp).toContain('https://api.vizora.example');
  });
});
