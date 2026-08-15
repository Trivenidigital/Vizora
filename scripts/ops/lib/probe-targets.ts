/**
 * Vizora Autonomous Operations — probe-target resolution.
 *
 * `WEB_URL` carries TWO incompatible meanings, and the collision is not
 * fixable in `.env`:
 *
 *   1. **Public origin** for backend-generated email links
 *      (`middleware/.../public-app-url.ts`). On prod this MUST be
 *      `https://vizora.cloud` — the config-drift detector raises HIGH when it
 *      points at localhost in production.
 *   2. **Health-probe target** for `health-guardian`. On prod that same value
 *      sent every 5-minute probe through nginx + TLS at the PUBLIC EDGE, so an
 *      edge fault (bad nginx config, expired cert, reload window) was
 *      classified as "web is down" and answered with `pm2 restart vizora-web`
 *      — a remediation that cannot fix an edge fault, applied to a healthy
 *      process. That fired on prod at 2026-08-15T06:20:07Z during a deploy
 *      reload window.
 *
 * The split therefore has to live in code. This module is that split:
 *
 *   - Anything a **remediation** keys off must be a LOOPBACK probe. A loopback
 *     200 means *this box's* Node process answered; restarting it is a
 *     coherent response.
 *   - A non-loopback value is IGNORED as a probe target — the local port is
 *     substituted — and becomes the `edge`, which is watched ALERT-ONLY.
 */

/** The three services this agent probes, in the order `edge` is resolved. */
export type ProbeService = 'middleware' | 'realtime' | 'web';

export const PROBE_SERVICES: readonly ProbeService[] = ['middleware', 'realtime', 'web'];

/**
 * Ports the three services listen on locally.
 *
 * These are hardcoded on purpose: middleware and realtime both validate their
 * port at startup and exit if it is misconfigured (see CLAUDE.md
 * "Architecture"), so the local port is a constant of the deployment, not a
 * tunable. Deriving it from env would re-open the same dual-meaning hole this
 * module exists to close.
 */
export const LOCAL_PROBE_PORTS: Record<ProbeService, number> = {
  middleware: 3000,
  realtime: 3002,
  web: 3001,
};

/** Env var each service's base URL is read from. */
export const PROBE_ENV_KEYS: Record<ProbeService, string> = {
  middleware: 'VALIDATOR_BASE_URL',
  realtime: 'REALTIME_URL',
  web: 'WEB_URL',
};

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * True when `url` addresses this box directly, bypassing every shared edge
 * component (DNS, nginx, TLS).
 *
 * Deliberately strict: an unparseable value, a bare `host:port`, or a scheme
 * we cannot reason about is NOT loopback. Everything that keys a restart is
 * gated on this returning true, so the fail-closed direction is "do not
 * restart".
 */
export function isLoopback(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // `new URL('http://[::1]:3001')` yields the hostname '[::1]'.
  const host = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  return LOOPBACK_HOSTS.has(host);
}

export interface ProbeTargets {
  /** Loopback base URL to probe per service. Always safe to remediate off. */
  local: Record<ProbeService, string>;
  /** Public edge base URL, or null when no watchable edge was configured. */
  edge: string | null;
  /**
   * Which service's env var supplied `edge`. Only ever `'web'`: `WEB_URL` is
   * the public origin BY DEFINITION (it is what backend email links are built
   * from), so it is the only value that can be asserted to address the edge.
   */
  edgeSource: 'web' | null;
  /** Log lines the caller must emit — substitutions are never silent. */
  notes: string[];
  /**
   * Why `edge` is null, or null when an edge WAS resolved.
   *
   * Distinct reasons matter: "everything is loopback" is the expected dev/CI
   * shape, while "WEB_URL is not an http(s) URL" is a misconfiguration that
   * would otherwise be reported with the same reassuring sentence.
   */
  noEdgeReason: string | null;
}

function normalize(url: string): string {
  return url.replace(/\/+$/, '');
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Resolve the loopback probe targets and the (optional) public edge.
 *
 * Per service: a loopback value is used as-is; a non-loopback value is ignored
 * for probing and replaced by `http://127.0.0.1:<local port>`.
 *
 * The edge is taken from `WEB_URL` **and only from `WEB_URL`**. Adopting the
 * first non-loopback value found would let a stray `REALTIME_URL` silently
 * become "the public edge" and be reported with nginx/certbot remediation text,
 * which is a claim we cannot support: `WEB_URL` is the one value the system
 * already defines as the public origin. Any other non-loopback value is
 * substituted for probing and explicitly noted as NOT WATCHED — substituted and
 * unwatched is a defensible state, substituted and silently mislabelled is not.
 */
export function splitProbeTargets(env: NodeJS.ProcessEnv): ProbeTargets {
  const local = {} as Record<ProbeService, string>;
  const notes: string[] = [];
  /** Non-loopback raw values, by service, in declaration order. */
  const nonLoopback = new Map<ProbeService, string>();

  for (const service of PROBE_SERVICES) {
    const key = PROBE_ENV_KEYS[service];
    const fallback = `http://127.0.0.1:${LOCAL_PROBE_PORTS[service]}`;
    const raw = (env[key] ?? '').trim();

    if (raw === '') {
      local[service] = fallback;
      continue;
    }

    if (isLoopback(raw)) {
      local[service] = normalize(raw);
      continue;
    }

    local[service] = fallback;
    nonLoopback.set(service, raw);
    notes.push(
      `${key}=${raw} is NOT a loopback address — ignored as a probe target ` +
        `(a restart cannot fix an edge fault); probing ${fallback} instead`,
    );
  }

  const webRaw = nonLoopback.get('web');
  let edge: string | null = null;
  let edgeSource: 'web' | null = null;
  let noEdgeReason: string | null = null;

  if (webRaw !== undefined && isHttpUrl(webRaw)) {
    edge = normalize(webRaw);
    edgeSource = 'web';
    notes.push(`WEB_URL adopted as the alert-only edge watch target: ${edge}`);
  } else if (webRaw !== undefined) {
    noEdgeReason =
      `WEB_URL=${webRaw} is neither loopback nor an http(s) URL, so it was substituted ` +
      `for probing and there is nothing watchable to treat as the public edge`;
  } else {
    noEdgeReason =
      'WEB_URL is loopback (or unset), so there is no public edge to watch ' +
      '(expected in dev/CI; on prod WEB_URL supplies it)';
  }

  // Every OTHER non-loopback value: substituted above, and never watched.
  for (const [service, raw] of nonLoopback) {
    if (service === 'web') continue;
    notes.push(
      `${PROBE_ENV_KEYS[service]}=${raw} is NOT WATCHED as an edge — only WEB_URL is the ` +
        `public origin; this value was substituted for probing and is otherwise ignored`,
    );
  }

  return { local, edge, edgeSource, notes, noEdgeReason };
}
