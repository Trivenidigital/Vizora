import { SetMetadata } from '@nestjs/common';

export const ALLOW_API_KEY = 'allowApiKey';

/**
 * Opt a route into API-key authentication, in ADDITION to the JWT session.
 *
 * Deliberately an opt-in on top of the global JwtAuthGuard rather than
 * `@Public()` plus a route-level composite guard. `@Public()` disables the
 * global guard outright, so if the composite were ever removed or misordered
 * the route would be left OPEN. Removing this decorator reverts the route to
 * JWT-only — it fails closed.
 *
 * Precedence is deterministic: when a route allows API keys AND the request
 * carries `x-api-key`, the key authenticates the request and a rejected key is
 * a 401. It does not silently fall back to a session cookie, because that would
 * let a broken integration appear to work as whichever human happened to be
 * signed in.
 */
export const AllowApiKey = () => SetMetadata(ALLOW_API_KEY, true);
