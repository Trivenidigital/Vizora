/**
 * Vizora Autonomous Operations — startup assertions (B3)
 *
 * Answers one question BEFORE a deploy mutates anything:
 *
 *   if these services are restarted right now, from the configuration that is
 *   actually persisted, will they come back?
 *
 * ─── Why this is wiring, not a new validator ────────────────────────────────
 *
 * B1 already answers "would a fresh start boot?" by running each service's OWN
 * validators — middleware's real Zod `validateEnv`, the bare-presence check,
 * and strict port enforcement — against the config a fresh process would
 * consume. Re-implementing any of that here would create a second copy that
 * drifts from the real one, and a drifting copy reports "would start fine"
 * when it would not. That is the exact failure the B1 ruling rejected.
 *
 * So this module contributes only two things B1 does not:
 *
 *   1. It builds the fresh-start environment from PERSISTED config alone —
 *      the ecosystem `env_production` block plus `.env`. No `/proc`, no
 *      `pm2 jlist`, no running process. That matters because the question is
 *      about a service that does not exist yet.
 *   2. It runs at the moment of mutation rather than hourly, so a config that
 *      cannot support a restart blocks the deploy instead of being reported
 *      after the restart already failed.
 *
 * ─── Detection only ─────────────────────────────────────────────────────────
 *
 * Nothing here repairs, writes a config file, or mutates a credential. It
 * returns findings; the caller decides. There is deliberately no override
 * flag: `pm2-guard` is cooperative-path prevention, so an operator who must
 * proceed anyway can still invoke pm2 directly. Adding a `--force` would move
 * the escape hatch inside the guard, where it would be used by habit.
 */

import {
  computeZeroState,
  validateFreshStart,
  type EnvMap,
  type ServiceName,
} from './config-drift.js';

/** Everything needed to reconstruct a fresh start, from persisted state only. */
export interface PersistedServiceConfig {
  service: ServiceName;
  /** The ecosystem `env_production` block — the canonical production start. */
  ecosystemEnvProduction: EnvMap;
  /** Parsed `.env`, or `null` for a service that loads no dotenv file (web). */
  dotenvVars: EnvMap | null;
}

export interface StartupAssertion {
  service: ServiceName;
  /** Human-readable reasons a fresh start would fail. Empty means it would boot. */
  failures: string[];
  /**
   * False when NO validator applies to this service, so an empty `failures`
   * proves nothing. `web` is the case today: it has no required production
   * variables, no port rule and no Zod schema. Reporting OK there would be
   * false assurance — the same false-green shape these guards exist to remove.
   */
  checked: boolean;
}

/**
 * Compute the environment a freshly started process would consume.
 *
 * Uses B1's `computeZeroState` so the precedence model has exactly one
 * implementation. The unused observation fields are the ones that describe a
 * RUNNING process; a service that has not started yet has none of them, and
 * that absence is the point rather than a gap.
 */
export function freshStartEnv(config: PersistedServiceConfig): EnvMap {
  return computeZeroState({
    service: config.service,
    instances: 0,
    procEnviron: null,
    pm2Env: {},
    ecosystemEnvProduction: config.ecosystemEnvProduction,
    ecosystemEnvDefault: {},
    dotenvVars: config.dotenvVars,
    stability: { stable: true, reason: 'not applicable — no running process' },
  });
}

/**
 * Would each of these services survive a restart on its persisted config?
 *
 * Returns one entry per service, in the order given. A service with an empty
 * `failures` array would boot.
 */
export function assertCanRestart(configs: PersistedServiceConfig[]): StartupAssertion[] {
  return configs.map(config => ({
    service: config.service,
    failures: validateFreshStart(config.service, freshStartEnv(config)),
    checked: SERVICES_WITH_VALIDATORS.has(config.service),
  }));
}

/**
 * Services that actually have boot validators to run.
 *
 * `web` has none — no REQUIRED_IN_PRODUCTION entries, no port enforcement, no
 * Zod schema — so nothing can be asserted about it here.
 */
const SERVICES_WITH_VALIDATORS = new Set<ServiceName>(['middleware', 'realtime']);

/** True when any service would fail to come back. */
export function anyServiceWouldFail(assertions: StartupAssertion[]): boolean {
  return assertions.some(a => a.failures.length > 0);
}

/**
 * Operator-facing summary.
 *
 * Nothing here interpolates a configured value. The validators mostly do not
 * either — min-length, `.url()` and the custom refines all emit static text.
 *
 * ONE EXCEPTION, verified rather than assumed: zod's `invalid_enum_value`
 * echoes the received value. The only enum fields are `LOG_LEVEL` and
 * `NODE_ENV`, neither secret-bearing, so this is not a leak today — but it is
 * not the blanket guarantee an earlier version of this comment claimed, and
 * the day a secret-bearing field becomes an enum the output stops being safe
 * to paste. Pinned by a test so that change is loud.
 *
 * One message does contain a credential-looking literal — `MINIO_SECRET_KEY
 * must be set and not equal to "minioadmin" in production`. That string lives
 * in middleware's own validator source and is printed identically whatever the
 * operator configured, so it discloses only "your value equals the published
 * default", which is precisely the finding. Pinned by a test so it is not
 * mistaken for an echo later.
 */
export function renderStartupAssertions(
  assertions: StartupAssertion[],
  notes: string[] = [],
): string {
  const lines: string[] = ['Startup assertions (would these services come back if restarted?)', ''];

  for (const note of notes) lines.push(`  note    ${note}`);
  if (notes.length > 0) lines.push('');

  for (const a of assertions) {
    if (!a.checked) {
      lines.push(`  SKIPPED ${a.service} — no boot validators exist for this service`);
      continue;
    }
    if (a.failures.length === 0) {
      lines.push(`  OK      ${a.service} — persisted config would boot`);
      continue;
    }
    lines.push(`  BLOCKED ${a.service} — persisted config would NOT boot:`);
    for (const failure of a.failures) lines.push(`            - ${failure}`);
  }

  if (anyServiceWouldFail(assertions)) {
    lines.push(
      '',
      'REFUSING to proceed. These services are running now, but could not be',
      'recreated from persisted config alone — so a reload would take them down',
      'and they would not come back.',
      '',
      'Note the "alone": a value currently supplied by the PM2 daemon environment',
      '(the pattern ecosystem.config.js documents for LIFECYCLE_LIVE) is NOT',
      'modelled here and would be reported missing. Check that before concluding',
      'the configuration is broken.',
      '',
      'Nothing was changed. No credential was read, written or logged.',
    );
  }

  return lines.join('\n');
}
