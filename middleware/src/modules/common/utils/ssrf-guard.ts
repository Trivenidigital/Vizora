import * as dns from 'dns/promises';
import * as net from 'net';

/**
 * SSRF guard for outbound HTTP destinations.
 *
 * Why this exists: a hostname-only regex check is bypassable with DNS —
 * a public-looking hostname can resolve to 127.0.0.1, 169.254.169.254
 * (AWS IMDS), RFC1918, IPv6 ULA, etc., and fetch() will still happily
 * connect. Anyone calling this must validate the RESOLVED IPs, not just
 * the hostname string.
 *
 * Usage:
 *   await assertUrlIsPublic(url);                       // https-only
 *   await assertUrlIsPublic(url, { allowHttp: true });  // widget polling
 *
 * Pair with `redirect: 'manual'` on fetch(); a redirect to a private host
 * would otherwise bypass this check.
 *
 * TOCTOU note: there is a small window between dns.lookup() and the
 * actual fetch() where DNS could flip. To close it completely we'd need
 * to dispatch to the resolved IP directly with a Host header override
 * (and TLS SNI override for https). v1 accepts the window — it's
 * milliseconds wide and an attacker would need exact timing control. If
 * a real DNS-rebind attack ever lands, upgrade to resolve-then-pin.
 *
 * Shared across O5 (webhooks) and O8 (generic-api widget). Duplicated
 * on each branch because the PRs were authored independently; when the
 * second merges, drop the duplicate.
 */
export interface SsrfCheckOptions {
  /** Allow plain http:// in addition to https://. Default: https-only. */
  allowHttp?: boolean;
}

// IPv4 ranges that must never be reachable from outbound fetches.
// loopback (127/8), RFC1918 (10/8, 172.16/12, 192.168/16), unspecified
// (0/8), link-local (169.254/16 — covers AWS/GCP/Azure metadata IPs).
const BLOCKED_IPV4_PATTERNS: readonly RegExp[] = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
];

const BLOCKED_IPV6_EXACT: ReadonlySet<string> = new Set(['::', '::1']);

export async function assertUrlIsPublic(
  url: string,
  opts: SsrfCheckOptions = {},
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfError('url is not a valid absolute URL');
  }

  const allowedProtocols = opts.allowHttp ? ['http:', 'https:'] : ['https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new SsrfError(
      `url must use ${opts.allowHttp ? 'HTTP or HTTPS' : 'HTTPS'}`,
    );
  }

  // Node's URL parser returns IPv6 hostnames WITH brackets, e.g. "[fe80::1]".
  // Strip them before classification.
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) {
    throw new SsrfError('url has no hostname');
  }

  // Reject the magic "localhost" label up-front. Resolver returns 127.0.0.1
  // on most systems and we'd block it via resolved-IP check anyway, but
  // some hosts have /etc/hosts overrides — explicit reject avoids the
  // ambiguity.
  if (hostname === 'localhost') {
    throw new SsrfError('url points to a blocked address');
  }

  // Resolve DNS. all:true returns both A and AAAA records so we don't
  // miss a host whose A record is public but AAAA is private (or vice
  // versa).
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new SsrfError('url hostname does not resolve');
  }

  if (records.length === 0) {
    throw new SsrfError('url hostname did not resolve to any address');
  }

  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new SsrfError('url points to a blocked address');
    }
  }
}

export function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return BLOCKED_IPV4_PATTERNS.some((p) => p.test(ip));
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (BLOCKED_IPV6_EXACT.has(lower)) return true;

    // IPv4-mapped IPv6 (::ffff:127.0.0.1) — classify the embedded v4.
    if (lower.startsWith('::ffff:')) {
      const v4 = lower.slice('::ffff:'.length);
      if (net.isIP(v4) === 4) {
        return BLOCKED_IPV4_PATTERNS.some((p) => p.test(v4));
      }
    }

    // 6to4 (2002::/16) embeds an IPv4 address in bits 17..48; bytes
    // following the 2002: prefix encode the v4 octets in hex.
    if (lower.startsWith('2002:')) {
      const segs = lower.split(':');
      // 2002:AABB:CCDD::  → AA.BB.CC.DD
      if (segs.length >= 3 && /^[0-9a-f]{1,4}$/.test(segs[1]) && /^[0-9a-f]{1,4}$/.test(segs[2])) {
        const v4 = ipv6SegsToV4(segs[1], segs[2]);
        if (v4 && BLOCKED_IPV4_PATTERNS.some((p) => p.test(v4))) return true;
      }
    }

    // Unique-local fc00::/7 — first byte 0xfc or 0xfd → segment starts with "fc" or "fd".
    if (/^f[cd]/.test(lower)) return true;

    // Link-local fe80::/10 — first 10 bits 1111111010 → segment fe8x/fe9x/feax/febx.
    if (/^fe[89ab]/.test(lower)) return true;

    return false;
  }
  // Not a valid IP (shouldn't happen for dns.lookup output, but be safe).
  return false;
}

function ipv6SegsToV4(seg1: string, seg2: string): string | null {
  const a = parseInt(seg1.padStart(4, '0').slice(0, 2), 16);
  const b = parseInt(seg1.padStart(4, '0').slice(2, 4), 16);
  const c = parseInt(seg2.padStart(4, '0').slice(0, 2), 16);
  const d = parseInt(seg2.padStart(4, '0').slice(2, 4), 16);
  if ([a, b, c, d].some((n) => Number.isNaN(n))) return null;
  return `${a}.${b}.${c}.${d}`;
}

/**
 * Caller-mappable error. Callers turn this into BadRequestException at
 * the controller boundary — keeping the guard framework-agnostic so the
 * delivery path (no controller) can use it too.
 */
export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}
