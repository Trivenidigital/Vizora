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

/**
 * realtime's presence check cannot be satisfied by its dotenv file.
 *
 * `realtime/src/main.ts` has NO dotenv import at all, and its
 * `process.exit(1)` presence check for DATABASE_URL / REDIS_URL /
 * DEVICE_JWT_SECRET / JWT_SECRET / INTERNAL_API_SECRET runs at line 13 —
 * BEFORE `NestFactory.create(AppModule)` at line 23, which is where
 * ConfigModule would load one. So only the process environment can satisfy it.
 *
 * B1's zero-state model merges `<cwd>/.env` in, which is right for middleware
 * (`import 'dotenv/config'` is the first line of its main.ts) and optimistic
 * for realtime. B1 is a detector, so optimism there is a reportable inaccuracy.
 * Here it would become a POSITIVE VERDICT on a blocking gate — "OK realtime,
 * persisted config would boot" for a config that exits 1.
 *
 * So this dimension is reported as UNPROVABLE rather than passed. It is
 * deliberately not a refusal: on prod today those five variables do reach the
 * process (PM2 injects them), so refusing would block every deploy over a
 * modelling limit rather than a real defect. Saying "not proven" is the honest
 * verdict; claiming OK is not.
 */
const PRESENCE_NOT_SATISFIABLE_FROM_DOTENV = new Set<ServiceName>(['realtime']);

export interface StartupAssertion {
  service: ServiceName;
  /** Human-readable reasons a fresh start would fail. Empty means it would boot. */
  failures: string[];
  /** Dimensions this gate cannot prove from persisted config alone. */
  unprovable: string[];
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
  return configs.map(config => {
    const env = freshStartEnv(config);
    const failures = validateFreshStart(config.service, env);

    // A fresh start that is not production skips the presence check AND the
    // Zod superRefine, so an empty `failures` would mean "almost nothing ran",
    // not "would boot". That is the 2026-08-12 incident shape exactly —
    // services up in development mode with both validators bypassed — so it is
    // a failure in its own right rather than a quiet OK.
    if (SERVICES_WITH_VALIDATORS.has(config.service) && env.NODE_ENV !== 'production') {
      failures.push(
        `fresh start would set NODE_ENV=${env.NODE_ENV ?? '(unset)'}, not production — ` +
        'both boot validators would be skipped and the service would come up in ' +
        'development mode',
      );
    }

    const unprovable: string[] = [];
    if (PRESENCE_NOT_SATISFIABLE_FROM_DOTENV.has(config.service)) {
      unprovable.push(
        'required-variable presence: realtime reads process.env directly before ' +
        'Nest loads any dotenv file, so its .env cannot satisfy that check and ' +
        'this gate cannot prove it from persisted config',
      );
    }

    return {
      service: config.service,
      failures,
      unprovable,
      checked: SERVICES_WITH_VALIDATORS.has(config.service),
    };
  });
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
    // Order matters: a service with failures must NEVER render as SKIPPED.
    // The reverse order swallowed the reasons while `anyServiceWouldFail` still
    // refused — producing "REFUSING to proceed" with nothing stated.
    if (a.failures.length === 0 && !a.checked) {
      lines.push(`  SKIPPED ${a.service} — no boot validators exist for this service`);
      continue;
    }
    if (a.failures.length === 0) {
      if (a.unprovable.length > 0) {
        lines.push(`  PARTIAL ${a.service} — the checks that ran passed, but:`);
        for (const u of a.unprovable) lines.push(`            ? ${u}`);
        continue;
      }
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
