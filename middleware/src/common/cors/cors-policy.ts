/**
 * CORS policy for the middleware HTTP API.
 *
 * WHY THIS EXISTS
 * ---------------
 * Packaged Samsung Tizen and LG webOS display clients run from a `file://`
 * document, so their XHR/fetch calls carry `Origin: null`. That origin matches
 * no entry in the CORS_ORIGIN allowlist, so pairing was impossible from those
 * devices. This module grants a deliberately narrow exception.
 *
 * SECURITY MODEL
 * --------------
 * `Origin: null` is NOT a trustworthy signal — any site can produce it with a
 * sandboxed iframe (`<iframe sandbox>` without allow-same-origin). It is used
 * here only to select a POLICY, never as authentication. Two invariants carry
 * the boundary instead:
 *
 *   1. ENDPOINT SCOPE — only device routes that carry their own credential
 *      (device JWT) or are already public + rate-limited (pairing code
 *      endpoints). Every cookie-authenticated route is excluded.
 *   2. NO CREDENTIALED GRANT — a request carrying `Origin: null` NEVER receives
 *      `Access-Control-Allow-Credentials`, on ANY path, allowed or rejected.
 *      This is what prevents a hostile null-origin page from reading responses
 *      that a victim's ambient cookies would otherwise authorize.
 *
 * Note that (2) governs what a caller may READ, not what the browser transmits.
 * Request *effects* remain governed by SameSite, CSRF, authentication and
 * authorization — CORS is not and never was that boundary.
 *
 * FAIL-CLOSED: the exception is inert unless DEVICE_NULL_ORIGIN_CORS is
 * explicitly set to "enabled". Absent, empty, or any other value => disabled,
 * which restores byte-for-byte the behavior that shipped before this module.
 */

/** The only origin value that selects the device policy. Nothing else. */
export const NULL_ORIGIN = 'null';

/**
 * Device routes reachable from a packaged TV app. Listed WITHOUT the
 * `/api/v1` or `/api` prefix; `isDeviceCorsPath` matches both forms, mirroring
 * the discipline in csrf.middleware.ts (production runs the NestJS global
 * prefix `/api/v1`, while the test harness and legacy nginx rewrites also
 * produce `/api`).
 *
 * Deliberately EXCLUDED (cookie/session authenticated — must never appear):
 *   devices/pairing/complete, devices/pairing/active, displays/*
 */
export const DEVICE_CORS_ROUTES = [
  'devices/pairing/request',
  'devices/pairing/status',
  'devices/auth/check',
  'device-content',
] as const;

/** The device-content file route, which additionally needs a CORP relaxation. */
export const DEVICE_CONTENT_ROUTE = 'device-content';

const API_PREFIXES = ['/api/v1/', '/api/'] as const;

/** True when the flag is explicitly enabled. Anything else is disabled. */
export function isNullOriginCorsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.DEVICE_NULL_ORIGIN_CORS === 'enabled';
}

/** Strip query/fragment so `?`-manipulation cannot alter path matching. */
function pathnameOf(url: string | undefined): string {
  return (url ?? '').split('?')[0].split('#')[0];
}

/**
 * Anchored match against the device route list. A route matches when the path
 * is exactly `<prefix><route>` or begins `<prefix><route>/` — so sibling names
 * (`devices/pairing/requestX`) and embedded paths (`/evil/api/v1/...`) do NOT
 * match.
 */
export function isDeviceCorsPath(url: string | undefined): boolean {
  const pathname = pathnameOf(url);
  return API_PREFIXES.some((prefix) =>
    DEVICE_CORS_ROUTES.some((route) => {
      const full = prefix + route;
      return pathname === full || pathname.startsWith(full + '/');
    }),
  );
}

/** True only for the device-content route (CORP relaxation scope). */
export function isDeviceContentPath(url: string | undefined): boolean {
  const pathname = pathnameOf(url);
  return API_PREFIXES.some((prefix) => {
    const full = prefix + DEVICE_CONTENT_ROUTE;
    return pathname === full || pathname.startsWith(full + '/');
  });
}

export interface ResolvedCorsOptions {
  origin: string | string[] | boolean;
  credentials: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  maxAge?: number;
}

export interface CorsPolicyInput {
  origin: string | undefined;
  url: string | undefined;
}

/** Browser policy — identical to what shipped before this module existed. */
function browserPolicy(corsOrigins: string[], isRestrictedEnv: boolean): ResolvedCorsOptions {
  return {
    origin: isRestrictedEnv ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  };
}

/**
 * The single CORS decision. Exported separately from the delegate so it can be
 * unit-tested as a pure function.
 *
 * Ordering is load-bearing: the null-origin branch is evaluated FIRST and
 * always returns `credentials: false`, so no null-origin response can ever
 * carry Access-Control-Allow-Credentials — including on excluded paths, where
 * `origin: false` additionally suppresses Access-Control-Allow-Origin.
 */
export function resolveCorsOptions(
  input: CorsPolicyInput,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedCorsOptions {
  const corsOrigins = env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ?? [];
  const isRestrictedEnv = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';

  if (input.origin === NULL_ORIGIN) {
    // NEVER credentialed, whatever the path or flag state.
    if (isNullOriginCorsEnabled(env) && isDeviceCorsPath(input.url)) {
      return {
        origin: NULL_ORIGIN,
        credentials: false,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600,
      };
    }
    return { origin: false, credentials: false };
  }

  return browserPolicy(corsOrigins, isRestrictedEnv);
}

/**
 * Request-aware delegate for `app.enableCors(...)`.
 *
 * ExpressAdapter.enableCors(options) does `this.use(cors(options))`, and the
 * cors package treats a function as a per-request options callback — so this
 * is ONE middleware making ONE decision. It deliberately replaces (rather than
 * layers on top of) the previous static config: a custom middleware running
 * before a static `credentials: true` cors() would emit
 * `Access-Control-Allow-Origin: null` together with
 * `Access-Control-Allow-Credentials: true`, which is exactly the credentialed
 * null-origin grant this module exists to prevent.
 */
export function createCorsDelegate(env: NodeJS.ProcessEnv = process.env) {
  return function corsOptionsDelegate(
    req: { headers: Record<string, unknown>; originalUrl?: string; url?: string },
    callback: (err: Error | null, options?: ResolvedCorsOptions) => void,
  ): void {
    const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : undefined;
    callback(null, resolveCorsOptions({ origin, url: req.originalUrl || req.url }, env));
  };
}
