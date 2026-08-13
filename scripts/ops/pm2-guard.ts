#!/usr/bin/env npx tsx
/**
 * Vizora — guarded PM2 application operations (B2b)
 *
 * Resolves and PRINTS exactly what a PM2 operation would touch — and the exact
 * command it will run — validates the whole set against the operation's allowed
 * class, and only then invokes PM2, via the ecosystem file constrained by an
 * exact `--only` selector.
 *
 * The printed command is produced by the SAME `buildPm2Argv()` that executes, so
 * a dry run cannot describe an invocation different from the real one.
 *
 *   npx tsx scripts/ops/pm2-guard.ts app-reload --env production [--dry-run]
 *   npx tsx scripts/ops/pm2-guard.ts app-start  --env production [--dry-run]
 *
 * Exit codes:
 *   0  PASS (mutation performed, or dry run completed)
 *   1  REFUSED
 *   2  could not evaluate (config/PM2 unreadable) — never mutates
 *
 * ─── What this prevents ─────────────────────────────────────────────────────
 *
 * On 2026-08-12 `pm2 reload ecosystem.config.js --env production` reloaded the
 * three app services, STARTED `ops-db-maintainer` (which ran a real VACUUM on
 * production), and RE-REGISTERED `ops-config-drift-detector` — a cron entry that
 * had been deliberately deleted. Earlier the same hour the same command WITHOUT
 * `--env production` put all three services into development mode, skipping both
 * boot validators and exposing Swagger publicly.
 *
 * The mutation uses the ecosystem file WITH an exact `--only` selector. The file
 * is required because `--env` only selects an `env_*` block from a process file —
 * naming registered processes instead reuses PM2's stored environment, which is
 * the mutable state that caused the incident. `--only` is what keeps the
 * mutation inside the resolved set. Both behaviours were verified against the
 * installed PM2 6.0.14 in an isolated PM2_HOME fixture.
 *
 * ─── Enforcement boundary ───────────────────────────────────────────────────
 *
 * This guards the COOPERATIVE path. Root, or any non-interactive agent, can
 * still call `pm2` directly and bypass it — which is exactly what happened on
 * 2026-08-12. B1 (config-drift-detector) is the DETECTION backstop for that
 * case; it caught the dev-mode regression within seconds. This is deliberately
 * NOT described as preventing a determined bypass, and making it one would mean
 * changing host permissions — a separate, larger control-plane decision.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPm2Argv,
  evaluateOperation,
  renderReport,
  type EcosystemAppSummary,
  type Operation,
} from './lib/pm2-guard.js';
import {
  anyServiceWouldFail,
  assertCanRestart,
  renderStartupAssertions,
  type PersistedServiceConfig,
} from './lib/startup-assertions.js';
import {
  readServiceDotenv,
  serviceCwdFor,
  type EnvMap,
  type ServiceName,
} from './lib/config-drift.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ECOSYSTEM_PATH = join(REPO_ROOT, 'ecosystem.config.js');
const MANIFEST_PATH = join(REPO_ROOT, 'deploy', 'pm2-app-classes.json');
const PM2_TIMEOUT_MS = 60_000;

const OPERATIONS: Operation[] = ['app-reload', 'app-start'];

function usage(): string {
  return [
    'usage: pm2-guard.ts <app-reload|app-start> --env production [--dry-run]',
    '',
    '  app-reload   reload the registered application services',
    '  app-start    start application services that are not yet registered',
    '',
    '  --dry-run    resolve, classify, validate and print — but never invoke PM2',
  ].join('\n');
}

/** Raw ecosystem entry — only the fields this guard reads. */
interface EcosystemApp {
  name: string;
  cron_restart?: string;
  cwd?: string;
  env_production?: Record<string, unknown>;
}

/**
 * Load the ecosystem ONCE per invocation.
 *
 * It used to be `require`d twice, and web's `env_production` block is an IIFE
 * that reads `web/.env.local` from disk, so a second evaluation repeated that
 * side effect for nothing.
 */
function readEcosystem(): EcosystemApp[] {
  const require = createRequire(import.meta.url);
  delete require.cache[require.resolve(ECOSYSTEM_PATH)];
  return (require(ECOSYSTEM_PATH) as { apps?: EcosystemApp[] }).apps ?? [];
}

function summarizeApps(apps: EcosystemApp[]): EcosystemAppSummary[] {
  return apps.map(a => ({ name: a.name, cronRestart: a.cron_restart }));
}

/** PM2 app name -> the ServiceName its validators are registered under. */
export const SERVICE_BY_APP: Record<string, ServiceName> = {
  'vizora-middleware': 'middleware',
  'vizora-realtime': 'realtime',
  'vizora-web': 'web',
};

/**
 * B3 — build each targeted service's fresh-start config from persisted state.
 *
 * Reads only what a fresh process would consume: the ecosystem
 * `env_production` block plus THAT SERVICE'S OWN `.env`. No `/proc`, no
 * `pm2 jlist` env — the question is about a process that does not exist yet.
 *
 * The dotenv file is resolved through `readServiceDotenv(resolve(REPO_ROOT,
 * app.cwd))`, the same loader the drift detector uses. An earlier revision read
 * the repo-root `.env` for every service, which is wrong in both directions:
 * the services set `cwd` per service and resolve dotenv under it, and on prod
 * the two files agree only because `middleware/.env` is a SYMLINK. With that
 * symlink missing this would have reported "would boot" for a service that
 * exits 1 on start — the exact failure the gate exists to prevent.
 */
export function readPersistedConfigs(
  names: string[],
  apps: EcosystemApp[],
  /** Injected so the per-service cwd resolution — the D1 repair — is testable. */
  repoRoot: string = REPO_ROOT,
): { configs: PersistedServiceConfig[]; notes: string[] } {
  const configs: PersistedServiceConfig[] = [];
  const notes: string[] = [];

  for (const name of names) {
    const service = SERVICE_BY_APP[name];
    if (!service) {
      // Never silently skip: an app-service absent from the map would be
      // reloaded with nothing asserted about it.
      notes.push(`${name}: no validator mapping — NOT asserted`);
      continue;
    }
    // A many-to-one SERVICE_BY_APP would otherwise silently drop a service, so
    // record it rather than `continue` quietly. (Cluster instances share one
    // ecosystem entry and one name, so clustering cannot reach this.)
    if (configs.some(c => c.service === service)) {
      notes.push(`${name}: maps to ${service}, already asserted — NOT asserted separately`);
      continue;
    }

    const app = apps.find(a => a.name === name);
    const serviceCwd = serviceCwdFor(repoRoot, service, app?.cwd);
    const dotenvVars = readServiceDotenv(serviceCwd);
    notes.push(
      `${service}: dotenv ${join(serviceCwd, '.env')} ${dotenvVars ? 'loaded' : 'NOT FOUND'}`,
    );

    const envProduction: EnvMap = {};
    for (const [k, v] of Object.entries(app?.env_production ?? {})) {
      if (v !== undefined && v !== null) envProduction[k] = String(v);
    }
    configs.push({ service, ecosystemEnvProduction: envProduction, dotenvVars });
  }
  return { configs, notes };
}

function readManifest(): Record<string, string> {
  const raw = readFileSync(MANIFEST_PATH, 'utf-8');
  return (JSON.parse(raw) as { classes: Record<string, string> }).classes;
}

/** Names PM2 currently manages. */
function readRegistered(): string[] {
  const out = execFileSync('pm2', ['jlist'], { stdio: 'pipe', timeout: PM2_TIMEOUT_MS }).toString();
  const parsed = JSON.parse(out) as { name?: string }[];
  return Array.isArray(parsed) ? parsed.map(p => p.name).filter((n): n is string => Boolean(n)) : [];
}

function main(): void {
  const argv = process.argv.slice(2);
  const operation = argv[0] as Operation;
  const dryRun = argv.includes('--dry-run');
  const envIndex = argv.indexOf('--env');
  const environment = envIndex >= 0 ? argv[envIndex + 1] ?? '' : '';

  if (!OPERATIONS.includes(operation)) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 2;
    return;
  }

  let ecosystemApps: EcosystemApp[];
  let apps: EcosystemAppSummary[];
  let manifest: Record<string, string>;
  let registered: string[];
  try {
    ecosystemApps = readEcosystem();
    apps = summarizeApps(ecosystemApps);
    manifest = readManifest();
    registered = readRegistered();
  } catch (err) {
    // Cannot establish what would be touched ⇒ never touch anything.
    process.stderr.write(
      `pm2-guard: cannot evaluate the operation — ${err instanceof Error ? err.message : err}\n` +
      'Refusing without mutating.\n',
    );
    process.exitCode = 2;
    return;
  }

  const decision = evaluateOperation({ operation, environment, apps, manifest, registered });

  if (decision.verdict !== 'PASS') {
    process.stdout.write(`${renderReport(decision, dryRun, ECOSYSTEM_PATH)}\n`);
    process.exitCode = 1;
    return;
  }

  // B3 — the targets are classified and the command is resolved, but a reload
  // still takes these processes DOWN before bringing them back. Assert they
  // could actually come back, using each service's own validators, BEFORE
  // anything prints `VERDICT: PASS` or the exact command: printing a
  // copy-pasteable invocation above a refusal hands the operator the bypass.
  // Runs for --dry-run too, so the check is provable without risk.
  let assertionNotes: string[] = [];
  let assertions: ReturnType<typeof assertCanRestart> = [];
  try {
    const persisted = readPersistedConfigs(decision.invokeNames, ecosystemApps);
    assertionNotes = persisted.notes;
    assertions = assertCanRestart(persisted.configs);
  } catch (err) {
    // Same contract as the resolution step: cannot evaluate ⇒ never mutate.
    process.stderr.write(
      `pm2-guard: cannot assert restart safety — ${err instanceof Error ? err.message : err}\n` +
      'Refusing without mutating.\n',
    );
    process.exitCode = 2;
    return;
  }

  if (anyServiceWouldFail(assertions)) {
    process.stdout.write(`${renderStartupAssertions(assertions, assertionNotes)}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${renderReport(decision, dryRun, ECOSYSTEM_PATH)}\n`);
  process.stdout.write(`\n${renderStartupAssertions(assertions, assertionNotes)}\n`);

  if (dryRun) {
    process.stdout.write('\ndry run — PM2 was not invoked.\n');
    return;
  }

  // Ecosystem file + exact --only selector. The file is what makes `--env
  // production` actually consume env_production; --only is what keeps the
  // mutation inside the resolved set. Verified on PM2 6.0.14 — see lib docblock.
  const pm2Argv = buildPm2Argv(decision, ECOSYSTEM_PATH);
  if (!pm2Argv) {
    process.stderr.write('pm2-guard: validation passed but produced no invocation — refusing.\n');
    process.exitCode = 2;
    return;
  }
  try {
    execFileSync('pm2', pm2Argv, { stdio: 'inherit', timeout: PM2_TIMEOUT_MS });
    process.stdout.write(`\npm2 ${pm2Argv[0]} completed for: ${decision.invokeNames.join(', ')}\n`);
  } catch (err) {
    process.stderr.write(`\npm2 ${pm2Argv[0]} FAILED: ${err instanceof Error ? err.message : err}\n`);
    process.exitCode = 2;
  }
}

// Only run when invoked directly. Without this the module cannot be imported,
// which is why the D1 repair (per-service cwd resolution) shipped with no test
// of its own — a source mutation re-introducing the bug passed the whole suite.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
