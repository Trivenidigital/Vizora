import type { NextFunction, Request, Response } from 'express';

/**
 * CORS for packaged smart-TV clients (Samsung Tizen / LG webOS).
 *
 * A packaged TV app loads its `index.html` from `file://`, so Chromium labels every
 * request it makes with `Origin: null`. On Android the display client's HTTP goes
 * through Capacitor's native layer and bypasses CORS entirely; on TV the very same
 * `CapacitorHttp` calls fall through to the web implementation, which is a real
 * browser `fetch`. So the TV build cannot pair or authenticate unless the API answers
 * a null origin — verified against production 2026-09-02, where the preflight came
 * back 204 with no `Access-Control-Allow-Origin` and the browser therefore blocked it.
 *
 * WHY THIS IS AN EXACT-PATH ALLOWLIST, NOT A PREFIX RULE
 *
 * `POST /api/v1/devices/pairing/complete` and `GET /api/v1/devices/pairing/active` sit
 * under the SAME `devices/pairing` controller as the two endpoints a TV needs, and both
 * are operator endpoints behind RolesGuard and the user session cookie. A prefix rule on
 * `/devices/pairing` would hand a null origin the admin surface too. Every entry below
 * is matched on full path AND method.
 *
 * WHY NO CREDENTIALS
 *
 * `Access-Control-Allow-Credentials` is deliberately never set here. Device auth is a
 * bearer token (or a signed query parameter for `<img>`/`<video>` sources), never an
 * ambient cookie. Pairing `null` with credentials would let any sandboxed iframe or
 * local file make cookie-bearing requests on a victim's behalf, which is the one thing
 * this must not enable.
 *
 * WHY ALLOWING THE UNAUTHENTICATED PAIRING ENDPOINTS IS SAFE
 *
 * Worth stating explicitly, because "it's unauthenticated" sounds like the dangerous
 * case. CORS is not an authorization boundary: it governs whether a BROWSER may read a
 * cross-origin response, and it has never stopped a non-browser client. `curl` can call
 * both pairing endpoints today. What CORS does protect is endpoints carrying ambient
 * authority, where a victim's browser would attach credentials automatically — and
 * neither of these does. Their real defences are already in place and unchanged by this:
 *
 *   - `POST devices/pairing/request`     @Public, @SkipCsrf, throttled 5/min
 *   - `GET  devices/pairing/status/:code` @Public, throttled 40/min, and the code is an
 *                                         ephemeral 32^6 value with a 5-15 min TTL
 *
 * So this grants a web page exactly the capability it already had from its own server,
 * against endpoints that were designed as publicly reachable. It does not widen what an
 * attacker can reach; it stops the legitimate TV client from being the only caller that
 * is blocked.
 *
 * NOT COVERED HERE: the realtime Socket.IO gateway. Its CORS is shared with
 * cookie-authenticated dashboard sockets, so allowing a null origin there could not be
 * done without also exposing that surface. The TV connects websocket-first and the
 * WebSocket handshake is not CORS-governed, so it should not need this; the polling
 * fallback would be unavailable from a null origin. Deliberately left for hardware
 * evidence rather than widened speculatively.
 */

/** The exact device endpoints a packaged TV client calls. Nothing else. */
const DEVICE_ENDPOINTS: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  // Unpaired device asks for a pairing code.
  { method: 'POST', pattern: /^\/api\/v1\/devices\/pairing\/request$/ },
  // Unpaired device polls until an operator completes pairing, then reads its token.
  { method: 'GET', pattern: /^\/api\/v1\/devices\/pairing\/status\/[A-Za-z0-9]+$/ },
  // Paired device confirms its credential is still current (revocation contract §3.4).
  { method: 'GET', pattern: /^\/api\/v1\/devices\/auth\/check$/ },
  // Paired device pulls its effective content.
  { method: 'GET', pattern: /^\/api\/v1\/devices\/me\/content$/ },
  // Paired device downloads a content asset for the offline cache. `<img>`/`<video>`
  // rendering is not CORS-governed, but the TV cache manager fetches these to store
  // them in IndexedDB, and that fetch is.
  { method: 'GET', pattern: /^\/api\/v1\/device-content\/[^/]+\/file$/ },
];

/** Only what the TV client actually sends. */
const ALLOWED_HEADERS = 'Authorization,Content-Type';
const ALLOWED_METHODS = 'GET,POST,OPTIONS';
const MAX_AGE_SECONDS = '600';

/**
 * Is this request one of the device endpoints, by full path and effective method?
 *
 * For a preflight the method under test is `Access-Control-Request-Method`, not the
 * literal `OPTIONS` — checking the literal method would allow-list every preflight to
 * every path, including the operator endpoints this file exists to keep out.
 */
export function isDeviceNullOriginRequest(
  method: string,
  path: string,
  requestedMethod?: string,
): boolean {
  const effective = (
    method === 'OPTIONS' ? requestedMethod ?? '' : method
  ).toUpperCase();
  if (!effective) return false;
  return DEVICE_ENDPOINTS.some(
    (e) => e.method === effective && e.pattern.test(path),
  );
}

/**
 * Answer null-origin preflights and requests for the device endpoints.
 *
 * Must be installed BEFORE `app.enableCors(...)`: the global policy has no notion of the
 * request path, so it cannot make this distinction itself, and if it runs first it
 * answers the preflight without an allow-origin header and the browser gives up.
 * Requests that are not null-origin device requests fall straight through, so the
 * existing browser/dashboard origin policy is untouched.
 */
export function deviceNullOriginCors() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.headers.origin !== 'null') return next();

    const requestedMethod = req.headers['access-control-request-method'] as
      | string
      | undefined;
    if (!isDeviceNullOriginRequest(req.method, req.path, requestedMethod)) {
      return next();
    }

    res.setHeader('Access-Control-Allow-Origin', 'null');
    // Append rather than assign — the response varies on Origin for every other
    // policy too, and clobbering an existing Vary would poison shared caches.
    res.vary('Origin');
    // No Access-Control-Allow-Credentials, by design. See the header comment.

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Max-Age', MAX_AGE_SECONDS);
      res.status(204).end();
      return;
    }

    next();
  };
}
