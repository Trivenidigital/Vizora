/**
 * CORS + null-origin policy for the realtime (Socket.IO) service.
 *
 * SERVICE-LOCAL BY DESIGN. This deliberately does NOT import from
 * middleware/src — the two services must not depend on each other's internal
 * source trees. The overlap is two rules (the exact origin value, and
 * "never credentialed"), not shared data: realtime has no path dimension
 * because Socket.IO is a single endpoint, so there is no route list to share.
 * Equivalent assertions live in both services' test suites so the shared
 * invariants cannot silently diverge.
 *
 * WHY CORS IS NOT THE BOUNDARY HERE
 * ---------------------------------
 * CORS does not govern the native WebSocket handshake at all, and a
 * cross-origin request carries the Cookie header on BOTH transports. So on
 * realtime the security boundary is NOT this module — it is the handshake
 * authentication rule in device-handshake-auth.ts, which for `Origin: null`
 * ignores cookies entirely and requires a device JWT. This module only stops
 * a null-origin caller from *reading* polling responses credentialed.
 */

/** The only origin value that selects the device policy. Nothing else. */
export const NULL_ORIGIN = 'null';

/** True when the flag is explicitly enabled. Anything else is disabled. */
export function isNullOriginCorsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.DEVICE_NULL_ORIGIN_CORS === 'enabled';
}

export interface ResolvedCorsOptions {
  origin: string | string[] | boolean;
  credentials: boolean;
  methods?: string[];
}

function allowedBrowserOrigins(env: NodeJS.ProcessEnv): string[] {
  return env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
}

/**
 * The single CORS decision for the realtime HTTP surface (Engine.IO polling
 * and its preflight). Pure, for unit testing.
 *
 * A null origin is NEVER credentialed, enabled or not. When the flag is off
 * the origin is refused outright, matching the pre-change behavior.
 */
export function resolveRealtimeCorsOptions(
  origin: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  fallbackOrigins: string[] = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:4200',
  ],
): ResolvedCorsOptions {
  if (origin === NULL_ORIGIN) {
    return isNullOriginCorsEnabled(env)
      ? { origin: NULL_ORIGIN, credentials: false, methods: ['GET', 'POST', 'OPTIONS'] }
      : { origin: false, credentials: false };
  }

  const configured = allowedBrowserOrigins(env);
  return {
    origin: configured.length > 0 ? configured : fallbackOrigins,
    credentials: true,
  };
}

/**
 * Request-aware delegate for the Socket.IO/Engine.IO `cors` option.
 *
 * engine.io does `this.use(require("cors")(this.opts.cors))`, and the cors
 * package treats a function as a per-request options callback — so passing
 * this function as `cors` yields genuine per-origin credential behavior
 * rather than a static, one-size-fits-all header set.
 */
export function createRealtimeCorsDelegate(env: NodeJS.ProcessEnv = process.env) {
  return function corsOptionsDelegate(
    req: { headers: Record<string, unknown> },
    callback: (err: Error | null, options?: ResolvedCorsOptions) => void,
  ): void {
    const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : undefined;
    callback(null, resolveRealtimeCorsOptions(origin, env));
  };
}

/**
 * Whether a handshake presenting this Origin must go down the device-only
 * authentication path (cookies ignored, device JWT required).
 *
 * NOTE the fail-closed asymmetry: when the flag is DISABLED this returns false
 * and the caller rejects the connection outright — a null origin must never
 * fall through to the cookie or user-token paths in either flag state.
 */
export function isNullOrigin(origin: string | undefined): boolean {
  return origin === NULL_ORIGIN;
}
