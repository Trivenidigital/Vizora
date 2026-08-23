#!/usr/bin/env npx tsx
/**
 * CLI for the readiness stabilization gate. Run between a service reload and
 * `scripts/deploy-verify.sh`:
 *
 *   npx tsx scripts/ops/await-readiness-cli.ts [--base-url URL] [--consecutive N]
 *                                              [--timeout-ms N] [--interval-ms N]
 *
 * Exit 0 → readiness stabilized; run the pre/post deploy-verify comparison now.
 * Exit 1 → it never stabilized inside the budget. That IS a rollout failure —
 *          do not "just re-run deploy-verify"; investigate or roll back.
 *
 * See await-readiness.ts for why this exists (2026-08-22 false-failure incident).
 */
import { awaitReadiness, DEFAULT_CONSECUTIVE_OK, DEFAULT_TIMEOUT_MS, DEFAULT_INTERVAL_MS } from './await-readiness';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

const baseUrlIdx = process.argv.indexOf('--base-url');
const baseUrl =
  (baseUrlIdx !== -1 ? process.argv[baseUrlIdx + 1] : undefined) ??
  process.env.VALIDATOR_BASE_URL ??
  'http://127.0.0.1:3000';

const consecutiveOk = arg('consecutive', DEFAULT_CONSECUTIVE_OK);
const timeoutMs = arg('timeout-ms', DEFAULT_TIMEOUT_MS);
const intervalMs = arg('interval-ms', DEFAULT_INTERVAL_MS);

async function probe() {
  try {
    const res = await fetch(`${baseUrl}/api/v1/health/ready`, {
      signal: AbortSignal.timeout(10_000),
    });
    let readiness: string | null = null;
    try {
      const body: unknown = await res.json();
      // The response envelope wraps payloads in { success, data }; accept both
      // shapes so this does not silently read `undefined` if that changes.
      const d = (body as { data?: { status?: unknown }; status?: unknown } | null) ?? {};
      const s = (d.data?.status ?? d.status) as unknown;
      readiness = typeof s === 'string' ? s : null;
    } catch {
      readiness = null;
    }
    return { httpStatus: res.status, readiness };
  } catch {
    return { httpStatus: 0, readiness: null };
  }
}

async function main(): Promise<void> {
  const result = await awaitReadiness({
    consecutiveOk,
    timeoutMs,
    intervalMs,
    probe,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (line) => process.stdout.write(`${line}
`),
  });

  if (result.stabilized) {
    process.stdout.write(
      `READY: ${result.consecutiveOkReached} consecutive ok in ${Math.round(result.elapsedMs / 1000)}s ` +
        `(${result.samples} samples). Safe to run deploy-verify.
`,
    );
    process.exit(0);
  }

  process.stderr.write(
    `NOT READY after ${Math.round(result.elapsedMs / 1000)}s (${result.samples} samples, ` +
      `best streak ${result.consecutiveOkReached}/${consecutiveOk}). ` +
      `Last non-ok: http=${result.lastNonOk?.httpStatus ?? 'n/a'} ` +
      `status=${result.lastNonOk?.readiness ?? 'unparseable'}. ` +
      `This is a ROLLOUT FAILURE, not a warm-up.
`,
  );
  process.exit(1);
}

void main();
