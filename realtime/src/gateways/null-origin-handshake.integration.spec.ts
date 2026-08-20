/**
 * Null-origin handshake + CORS integration tests for the realtime service.
 *
 * WHY THIS RUNS AGAINST A REAL SOCKET.IO SERVER
 * ---------------------------------------------
 * CORS does not govern the native WebSocket handshake, and a cross-origin
 * connection delivers the Cookie header on BOTH transports. A mocked or
 * polling-only test cannot demonstrate that a null-origin page is unable to
 * authenticate via a victim's dashboard cookie — so every case below is
 * executed twice, once over 'websocket' and once over 'polling', against a
 * genuine socket.io server running the production handshake logic.
 */
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createServer, Server as HttpServer } from 'node:http';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { authenticateDeviceHandshake } from './device-handshake-auth';
import { createRealtimeCorsDelegate, isNullOrigin } from '../common/cors/cors-policy';

const DEVICE_SECRET = 'test-device-secret';
const USER_SECRET = 'test-user-secret';
const BROWSER_ORIGIN = 'https://dashboard.vizora.io';
const TRANSPORTS: Array<'websocket' | 'polling'> = ['websocket', 'polling'];

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

const jwtService = new JwtService({});
const deviceToken = jwtService.sign(
  { sub: 'device-1', deviceIdentifier: 'tizen-1', organizationId: 'org-1', type: 'device' },
  { secret: DEVICE_SECRET, algorithm: 'HS256', expiresIn: '90d' },
);
const userToken = jwtService.sign(
  { sub: 'user-1', organizationId: 'org-1', type: 'user' },
  { secret: USER_SECRET, algorithm: 'HS256', expiresIn: '1d' },
);

/** Minimal DB stub: device-1 is a live device whose stored hash matches. */
const databaseService = {
  display: {
    findUnique: jest.fn(async () => ({
      organizationId: 'org-1',
      isDisabled: false,
      jwtToken: hash(deviceToken),
      organization: { subscriptionStatus: 'active' },
    })),
  },
} as never;

let httpServer: HttpServer;
let server: Server;
let url: string;

/**
 * Wires the production handshake rule and CORS delegate onto a real server.
 * The cookie-fallback behavior mirrors device.gateway.ts getTokenFromClient:
 * a null origin must never reach it.
 */
function startServer(): Promise<void> {
  httpServer = createServer();
  server = new Server(httpServer, {
    transports: ['websocket', 'polling'],
    cors: createRealtimeCorsDelegate(),
  });

  server.use((socket, next) => {
    void (async () => {
      const origin = socket.handshake.headers?.origin;
      const result = await authenticateDeviceHandshake(
        socket.handshake.auth?.token as string | undefined,
        {
          jwtService,
          databaseService,
          deviceSecret: DEVICE_SECRET,
          userSecret: USER_SECRET,
          origin,
        },
      );

      if (result.action === 'reject') {
        const err = new Error(result.message);
        (err as Error & { data?: { code: string } }).data = { code: result.code };
        next(err);
        return;
      }
      if (result.action === 'accept') {
        socket.data.identity = { kind: 'device', id: result.payload.sub };
        next();
        return;
      }

      // 'pass' → the gateway's cookie/user path. Mirrors getTokenFromClient's
      // null-origin guard so the test exercises the same defence in depth.
      if (isNullOrigin(origin)) {
        next(new Error('auth_invalid'));
        return;
      }
      const cookie = socket.handshake.headers?.cookie ?? '';
      const match = cookie.match(/vizora_auth_token=([^;]+)/);
      if (match) {
        try {
          jwtService.verify(match[1], { secret: USER_SECRET, algorithms: ['HS256'] });
          socket.data.identity = { kind: 'user', id: 'user-1' };
          next();
          return;
        } catch {
          /* fall through */
        }
      }
      next(new Error('auth_invalid'));
    })();
  });

  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      url = `http://127.0.0.1:${(httpServer.address() as { port: number }).port}`;
      resolve();
    });
  });
}

interface ConnectResult {
  connected: boolean;
  code?: string;
  identity?: { kind: string; id: string };
}

function attempt(opts: {
  transport: 'websocket' | 'polling';
  origin?: string;
  cookie?: string;
  token?: string;
}): Promise<ConnectResult> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    if (opts.origin !== undefined) headers.Origin = opts.origin;
    if (opts.cookie) headers.Cookie = opts.cookie;

    const socket: ClientSocket = ioClient(url, {
      transports: [opts.transport],
      extraHeaders: headers,
      auth: opts.token ? { token: opts.token } : {},
      reconnection: false,
      timeout: 5000,
    });

    socket.on('connect', () => {
      socket.emit('whoami', null, () => undefined);
      resolve({ connected: true });
      socket.close();
    });
    socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
      resolve({ connected: false, code: err.data?.code ?? err.message });
      socket.close();
    });
  });
}

beforeAll(async () => {
  process.env.DEVICE_NULL_ORIGIN_CORS = 'enabled';
  process.env.CORS_ORIGIN = BROWSER_ORIGIN;
  await startServer();
});

afterAll(async () => {
  delete process.env.DEVICE_NULL_ORIGIN_CORS;
  server.close();
  httpServer.close();
});

describe.each(TRANSPORTS)('null-origin handshake over %s', (transport) => {
  it('accepts a valid device JWT', async () => {
    const res = await attempt({ transport, origin: 'null', token: deviceToken });
    expect(res.connected).toBe(true);
  });

  it('rejects a cookie-only handshake (no auth.token)', async () => {
    const res = await attempt({
      transport,
      origin: 'null',
      cookie: `vizora_auth_token=${userToken}`,
    });
    expect(res.connected).toBe(false);
    expect(res.code).toBe('AUTH_INVALID');
  });

  it('rejects a dashboard/user JWT presented in auth.token', async () => {
    const res = await attempt({ transport, origin: 'null', token: userToken });
    expect(res.connected).toBe(false);
    expect(res.code).toBe('AUTH_INVALID');
  });

  // The cookie must be IGNORED, not merely insufficient: identity comes from
  // the device token even when a valid user cookie rides along.
  it('ignores an accompanying user cookie when a device JWT is present', async () => {
    const res = await attempt({
      transport,
      origin: 'null',
      token: deviceToken,
      cookie: `vizora_auth_token=${userToken}`,
    });
    expect(res.connected).toBe(true);
  });

  it('rejects a handshake with neither cookie nor token', async () => {
    const res = await attempt({ transport, origin: 'null' });
    expect(res.connected).toBe(false);
    expect(res.code).toBe('AUTH_INVALID');
  });
});

describe.each(TRANSPORTS)('approved dashboard origin over %s', (transport) => {
  it('authenticates a dashboard client by cookie', async () => {
    const res = await attempt({
      transport,
      origin: BROWSER_ORIGIN,
      cookie: `vizora_auth_token=${userToken}`,
    });
    expect(res.connected).toBe(true);
  });

  it('still accepts a device JWT from a browser origin', async () => {
    const res = await attempt({ transport, origin: BROWSER_ORIGIN, token: deviceToken });
    expect(res.connected).toBe(true);
  });
});

describe.each(TRANSPORTS)('non-browser client over %s', (transport) => {
  it('accepts a device JWT with no Origin header (native Android path)', async () => {
    const res = await attempt({ transport, token: deviceToken });
    expect(res.connected).toBe(true);
  });
});

describe('polling transport CORS headers', () => {
  const handshakeUrl = () => `${url}/socket.io/?EIO=4&transport=polling`;

  it('echoes a null origin without credentials', async () => {
    const res = await fetch(handshakeUrl(), { headers: { Origin: 'null' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('null');
    expect(res.headers.has('access-control-allow-credentials')).toBe(false);
  });

  it('keeps credentials for the dashboard origin', async () => {
    const res = await fetch(handshakeUrl(), { headers: { Origin: BROWSER_ORIGIN } });
    expect(res.headers.get('access-control-allow-origin')).toBe(BROWSER_ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('grants an unknown origin nothing', async () => {
    const res = await fetch(handshakeUrl(), { headers: { Origin: 'https://evil.example' } });
    expect(res.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('answers a null-origin preflight without credentials', async () => {
    const res = await fetch(handshakeUrl(), {
      method: 'OPTIONS',
      headers: { Origin: 'null', 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('null');
    expect(res.headers.has('access-control-allow-credentials')).toBe(false);
  });
});

describe('fail-closed default (flag unset)', () => {
  let closedHttp: HttpServer;
  let closedServer: Server;
  let closedUrl: string;

  beforeAll(async () => {
    delete process.env.DEVICE_NULL_ORIGIN_CORS;
    closedHttp = createServer();
    closedServer = new Server(closedHttp, {
      transports: ['websocket', 'polling'],
      cors: createRealtimeCorsDelegate(),
    });
    closedServer.use((socket, next) => {
      void (async () => {
        const result = await authenticateDeviceHandshake(
          socket.handshake.auth?.token as string | undefined,
          {
            jwtService,
            databaseService,
            deviceSecret: DEVICE_SECRET,
            userSecret: USER_SECRET,
            origin: socket.handshake.headers?.origin,
          },
        );
        if (result.action === 'reject') {
          const err = new Error(result.message);
          (err as Error & { data?: { code: string } }).data = { code: result.code };
          next(err);
          return;
        }
        next();
      })();
    });
    await new Promise<void>((resolve) => {
      closedHttp.listen(0, () => {
        closedUrl = `http://127.0.0.1:${(closedHttp.address() as { port: number }).port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    closedServer.close();
    closedHttp.close();
    process.env.DEVICE_NULL_ORIGIN_CORS = 'enabled';
  });

  function attemptClosed(transport: 'websocket' | 'polling', token?: string): Promise<ConnectResult> {
    return new Promise((resolve) => {
      const socket = ioClient(closedUrl, {
        transports: [transport],
        extraHeaders: { Origin: 'null' },
        auth: token ? { token } : {},
        reconnection: false,
        timeout: 5000,
      });
      socket.on('connect', () => { resolve({ connected: true }); socket.close(); });
      socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
        resolve({ connected: false, code: err.data?.code ?? err.message });
        socket.close();
      });
    });
  }

  // Rejection must happen BEFORE any cookie, user-token, or device-token path.
  it.each(TRANSPORTS)('rejects even a valid device JWT over %s when unset', async (transport) => {
    const res = await attemptClosed(transport, deviceToken);
    expect(res.connected).toBe(false);
    expect(res.code).toBe('AUTH_INVALID');
  });

  it('does not consult the database when rejecting', async () => {
    (databaseService as unknown as { display: { findUnique: jest.Mock } }).display.findUnique.mockClear();
    await attemptClosed('websocket', deviceToken);
    expect(
      (databaseService as unknown as { display: { findUnique: jest.Mock } }).display.findUnique,
    ).not.toHaveBeenCalled();
  });

  it('grants no CORS headers on the polling endpoint', async () => {
    const res = await fetch(`${closedUrl}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: 'null' },
    });
    expect(res.headers.has('access-control-allow-origin')).toBe(false);
    expect(res.headers.has('access-control-allow-credentials')).toBe(false);
  });
});
