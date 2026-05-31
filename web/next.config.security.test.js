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
