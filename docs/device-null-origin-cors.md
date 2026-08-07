# Device null-origin CORS (packaged Samsung Tizen / LG webOS TV apps)

## Why this exists

The Vizora display client ships to Samsung Smart TVs (Tizen) and LG Smart TVs
(webOS) as a **packaged web app**. Those runtimes load `index.html` from a
`file://` document, so every XHR/`fetch` the app makes carries `Origin: null`.
That value matches no entry in the `CORS_ORIGIN` allowlist, so pairing was
impossible from those devices. This feature grants a deliberately narrow
exception.

Android TV is unaffected — it uses Capacitor's native HTTP, which is not
subject to CORS at all.

## Enabling it

Both services read the same variable, and **it is fail-closed**:

```bash
DEVICE_NULL_ORIGIN_CORS=enabled     # the ONLY value that activates the feature
```

Absent, empty, or any other value (`true`, `1`, `ENABLED`, …) means
**disabled**, which restores the exact behavior that shipped before this
feature. Each service logs its resolved state once at boot:

```
Device null-origin CORS: ENABLED
Device null-origin CORS: disabled (default)
```

Roll out staging first, validate on hardware, then production. To roll back,
unset the variable and restart — no deploy required.

## What it grants (middleware / HTTP)

Only these routes, matched anchored under both `/api/v1/*` and `/api/*`:

| Route | Method | Preflight? |
|---|---|---|
| `devices/pairing/request` | POST | Yes (`Content-Type`) |
| `devices/pairing/status/:code` | GET | No (simple request) |
| `devices/auth/check` | GET | Yes (`Authorization`) |
| `device-content/:id/file` | GET | Only for the cache `fetch` |

Response to an in-scope null-origin request: `Access-Control-Allow-Origin:
null`, `Vary: Origin`, and **never** `Access-Control-Allow-Credentials`.
Preflight answers 204 with `Allow-Methods: GET, POST, OPTIONS`,
`Allow-Headers: Content-Type, Authorization`, `Max-Age: 600`.

**Explicitly excluded** (and covered by tests asserting they stay excluded):
`devices/pairing/complete`, `devices/pairing/active`, all of `displays/*`, and
every other cookie-authenticated route.

`Cross-Origin-Resource-Policy` is relaxed to `cross-origin` on
`device-content/:id/file` **only**; helmet's `same-origin` default remains
everywhere else. This is a separate mechanism from CORS and is needed because
`<img>`/`<video>` loads are `no-cors` requests, which CORS does not govern but
CORP does. The offline cache's `fetch()` is the inverse case.

## What it grants (realtime / Socket.IO)

Socket.IO has no path dimension, so the CORS delegate applies to the endpoint
as a whole: a null origin gets an uncredentialed grant on the **polling**
transport (needed where WebSocket is blocked); browser origins keep
`credentials: true` so dashboard cookie authentication is unaffected.

**CORS is not the security boundary here.** The native WebSocket handshake is
not subject to CORS at all, and a cross-origin connection delivers the `Cookie`
header on *both* transports. The boundary is the transport-independent rule in
`realtime/src/gateways/device-handshake-auth.ts`:

```
Origin: null  →  ignore the Cookie header entirely
              →  require handshake.auth.token
              →  verify ONLY as a device JWT (never the user secret)
              →  reject dashboard/user tokens explicitly
```

When the flag is disabled, a null-origin connection is rejected **before** any
cookie, user-token, or device-token authentication path runs — it never
reaches the database.

## Security model

`Origin: null` is **not** a trustworthy signal: any website can produce it with
`<iframe sandbox>` (without `allow-same-origin`). It selects a policy; it never
authenticates. Two invariants carry the boundary:

1. **Endpoint scope** — only device routes that carry their own credential
   (device JWT) or are already public and rate-limited (pairing codes).
2. **No credentialed grant** — no response to a request carrying `Origin: null`
   ever includes `Access-Control-Allow-Credentials`, on any path, allowed or
   rejected.

### Accepted residual risk

This **does** give hostile web content a capability it lacked: requests to
these endpoints could always be *sent* from a browser, but the responses could
not be *read*. A page in a null-origin context can now read the responses of
the in-scope device endpoints, using a victim's browser and IP.

Note that invariant (2) governs what a caller may **read**, not what the
browser **transmits** — a cross-site request may still carry cookies depending
on the `SameSite` attribute and the request mode the caller chooses. Request
*effects* are governed by `SameSite` (`strict` in production for
`vizora_auth_token`), CSRF double-submit validation, authentication, and
authorization. CORS is not, and never was, that boundary.

The risk is accepted because of these mitigations, not because the capability
is absent:

- Every cookie-authenticated route is excluded, and tests assert it.
- `devices/auth/check` and `device-content/:id/file` require a valid device JWT
  (HS256, DB-hash-matched, `isDisabled`-checked); without one they 401.
- `pairing/status/:code` discloses a device token only to a caller who already
  knows the code: 5-15 min TTL, single completion, 40/60s throttle.
- `pairing/request` is throttled to 5/60s.
- No wildcard (`*`) CORS is introduced anywhere; the origin is echoed only for
  the exact value `null` on the exact enumerated paths.
- The CORP relaxation lets any site embed device-content media cross-origin.
  Content URLs already carry the device token as a query parameter, so
  possession of the URL was already equivalent to authorization — but this is a
  real, if narrow, widening and is recorded as such.

## Tests

- `middleware/src/common/cors/cors-policy.spec.ts` — pure policy unit tests.
- `middleware/src/common/cors/cors.integration.spec.ts` — boots a real Nest app
  with the production helmet + CORP + `enableCors(createCorsDelegate())` stack
  and asserts **final** response headers, including a blanket assertion that
  `Access-Control-Allow-Credentials` is absent for every null-origin request.
- `realtime/src/common/cors/cors-policy.spec.ts` — realtime policy units. These
  deliberately mirror the middleware assertions: the services own **separate**
  copies of the policy (no cross-service source imports), so the shared
  invariants are pinned in both suites and cannot silently diverge.
- `realtime/src/gateways/null-origin-handshake.integration.spec.ts` — a real
  socket.io server, every case executed over **both** `websocket` and
  `polling`: device-JWT success, cookie-only rejection, dashboard-token
  rejection, cookie-ignored-when-device-token-present, approved-origin cookie
  success, no-Origin native path, and the fail-closed default.

## On-device validation (release gate)

Do not enable in production until all of these pass on real hardware:

1. Capture request headers from a Tizen and a webOS device and confirm they
   send exactly `Origin: null`. **Only that value is accepted** — `file://` and
   variants are deliberately not supported without evidence.
2. Full pairing round-trip on each platform.
3. Media renders (CORP) and the IndexedDB offline cache populates (CORS fetch).
4. Force WebSocket-blocked conditions to exercise the polling fallback.
5. Confirm the dashboard is unaffected in a browser (login, live socket
   updates).

## Known gap: `GET /api/v1/devices/me/content`

The TV client calls this endpoint on every reconnect and on heartbeat
reconcile, but **it does not exist in the middleware** — the only `devices/*`
controllers are `devices/pairing` and `devices/auth`. It returns 404 and the
client's fail-safe keeps last-known-good content, so playback is unaffected,
but **pull-on-connect does not work** and no documentation should claim it
does. Tracked separately; deliberately out of scope for this change.
