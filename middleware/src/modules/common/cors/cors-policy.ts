/**
 * HTTP CORS policy for the middleware API.
 *
 * WHY THIS EXISTS
 * ---------------
 * Packaged LG webOS / Samsung Tizen display apps load from `file://`, so every
 * request they make carries `Origin: null`. That matches no CORS_ORIGIN entry,
 * so a packaged TV could not pair. `DEVICE_NULL_ORIGIN_CORS=enabled` grants a
 * narrow exception for the handful of device routes a TV calls.
 *
 * SECURITY MODEL
 * --------------
 * `Origin: null` is not a trustworthy signal: any page can produce it with a
 * sandboxed iframe. It selects a POLICY, never an identity. Two invariants:
 *
 *   1. SCOPE: only exact (method, path) pairs in DEVICE_NULL_ORIGIN_ROUTES.
 *      Those routes carry their own device credential or are public and
 *      rate-limited pairing endpoints. Cookie-authenticated routes
 *      (pairing/complete, pairing/active, displays/*) are never listed.
 *   2. NO CREDENTIALED GRANT: a request whose Origin is exactly `null` never
 *      receives Access-Control-Allow-Credentials, on any path, in either flag
 *      state.
 *
 * ONE DECISION. The delegate REPLACES the static `enableCors` options. It must
 * never be layered behind a separate null-origin middleware: cors@2.8.5 emits
 * ACAC from its static `credentials: true` regardless of whether the origin
 * matched, so a pre-middleware setting ACAO `null` ends up next to
 * `ACAC: true`. That defect was measured on PR #385.
 *
 * FLAG OFF IS NOT BYTE-IDENTICAL FOR `Origin: null`, by design. Before this
 * module the static credentialed options answered a null origin with a stray
 * `ACAC: true`: without ACAO in production, and next to a reflected ACAO
 * `null` in development. In either flag state a null origin now gets no CORS
 * headers outside the allowlist, which is strictly safer. Every non-null
 * origin still gets exactly the old options.
 *
 * CORS ONLY. Media from `device-content/:id/file` is loaded as no-cors
 * `<img>`/`<video>`, which CORP governs, not CORS. DeviceContentController
 * already sends `Cross-Origin-Resource-Policy: cross-origin` on every media
 * response, so helmet's CORP is left alone here.
 */
import type { NextFunction, Request, Response } from 'express';
import type { CorsOptions, CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

/** The only Origin header value that selects the device policy. */
export const NULL_ORIGIN = 'null';

/** The only flag value that enables the exception. Anything else is off. */
export const DEVICE_NULL_ORIGIN_FLAG_VALUE = 'enabled';

/**
 * Exact (method, path) pairs a packaged TV may call with `Origin: null`.
 * Paths are anchored at both ends and include the global prefix, because the
 * cors middleware is app-level and runs before routing, so it sees the full
 * request path. nginx rewrites legacy `/api/` to `/api/v1/` before proxying.
 */
export const DEVICE_NULL_ORIGIN_ROUTES: ReadonlyArray<{ method: 'GET' | 'POST'; path: RegExp }> = [
  { method: 'POST', path: /^\/api\/v1\/devices\/pairing\/request$/ },
  { method: 'GET', path: /^\/api\/v1\/devices\/pairing\/status\/[A-Za-z0-9]+$/ },
  { method: 'GET', path: /^\/api\/v1\/devices\/auth\/check$/ },
  { method: 'GET', path: /^\/api\/v1\/devices\/me\/content$/ },
  { method: 'GET', path: /^\/api\/v1\/device-content\/[A-Za-z0-9-]+\/file$/ },
];

export interface DeviceNullOriginFlag {
  enabled: boolean;
  /** The raw value when set but not recognised, so boot can warn once. */
  unrecognisedValue?: string;
}

export function resolveDeviceNullOriginFlag(
  env: NodeJS.ProcessEnv = process.env,
): DeviceNullOriginFlag {
  const raw = env.DEVICE_NULL_ORIGIN_CORS;
  if (raw === DEVICE_NULL_ORIGIN_FLAG_VALUE) return { enabled: true };
  if (raw === undefined || raw === '') return { enabled: false };
  return { enabled: false, unrecognisedValue: raw };
}

/** Path without the query string. */
function pathOf(req: Pick<Request, 'originalUrl' | 'url'>): string {
  return (req.originalUrl ?? req.url ?? '').split('?')[0];
}

/**
 * The method a request is asking to use. For a preflight that is the
 * Access-Control-Request-Method header, never the literal OPTIONS.
 */
function requestedMethod(req: Pick<Request, 'method' | 'headers'>): string | undefined {
  if (req.method?.toUpperCase() === 'OPTIONS') {
    const acrm = req.headers['access-control-request-method'];
    return typeof acrm === 'string' ? acrm.toUpperCase() : undefined;
  }
  return req.method?.toUpperCase();
}

export function isDeviceNullOriginRoute(
  req: Pick<Request, 'method' | 'headers' | 'originalUrl' | 'url'>,
): boolean {
  const method = requestedMethod(req);
  const path = pathOf(req);
  return DEVICE_NULL_ORIGIN_ROUTES.some((r) => r.method === method && r.path.test(path));
}

export interface CorsPolicyConfig {
  corsOrigins: string[];
  isRestrictedEnv: boolean;
  deviceNullOriginEnabled: boolean;
}

export function buildCorsOptionsDelegate({
  corsOrigins,
  isRestrictedEnv,
  deviceNullOriginEnabled,
}: CorsPolicyConfig): CorsOptionsDelegate<Request> {
  // Unchanged from the static options main.ts passed before this module.
  const browserOptions: CorsOptions = {
    origin: isRestrictedEnv
      ? corsOrigins
      : true, // Allow all in development
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  };
  const deviceOptions: CorsOptions = {
    origin: NULL_ORIGIN,
    credentials: false,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  };
  // `origin: false` makes cors call next() without setting any header.
  const rejectOptions: CorsOptions = { origin: false };

  return (req, callback) => {
    if (req.headers.origin !== NULL_ORIGIN) {
      callback(null, browserOptions);
      return;
    }
    callback(null, deviceNullOriginEnabled && isDeviceNullOriginRoute(req) ? deviceOptions : rejectOptions);
  };
}

/**
 * Applies helmet, Vary: Origin, then CORS. main.ts
 * and the integration spec both call this, so the spec exercises the exact
 * production wiring.
 */
export function applyHttpSecurity(app: INestApplication, env: NodeJS.ProcessEnv = process.env): DeviceNullOriginFlag {
  const flag = resolveDeviceNullOriginFlag(env);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false, // Allow embedding for display clients
  }));

  // The reject branch (`origin: false`) makes cors set no headers at all,
  // including Vary. The old static config always varied on Origin, and caches
  // need it whenever the response depends on Origin. res.vary appends and
  // dedupes, so the Vary cors adds on granted responses is not duplicated.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers.origin !== undefined) res.vary('Origin');
    next();
  });

  // CORS configuration - staging mirrors production restrictions
  const corsOrigins = env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [];
  const isRestrictedEnv = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
  app.enableCors(buildCorsOptionsDelegate({
    corsOrigins,
    isRestrictedEnv,
    deviceNullOriginEnabled: flag.enabled,
  }));

  return flag;
}
