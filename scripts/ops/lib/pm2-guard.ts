/**
 * Vizora Autonomous Operations — B2b guarded PM2 operations (pure logic)
 *
 * Resolves and validates what a PM2 operation would touch BEFORE anything is
 * mutated. All I/O lives in `scripts/ops/pm2-guard.ts`; everything here is
 * deterministic so the target-resolution rules are testable without PM2.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * On 2026-08-12 a single command caused three separate unintended effects, none
 * of them visible in the command text:
 *
 *     pm2 reload ecosystem.config.js --env production
 *       → reloaded the 3 app services              (intended)
 *       → STARTED ops-db-maintainer                 (ran a real VACUUM on prod)
 *       → RE-REGISTERED ops-config-drift-detector   (resurrected a deliberately
 *                                                    deleted cron entry)
 *
 * and earlier the same hour, the same command WITHOUT `--env production` put all
 * three services into development mode in production — skipping both boot
 * validators and exposing Swagger publicly.
 *
 * Two properties follow directly from that:
 *
 *   1. The resolved target set must be printed and validated before mutation,
 *      so "what will this touch?" is answered deterministically rather than
 *      discovered afterwards.
 *   2. The mutation must apply `env_production` FROM the ecosystem file AND
 *      touch exactly the resolved set — which requires the ecosystem file plus
 *      an exact `--only` selector, not bare process names.
 *
 * ─── Why `--only`, established empirically ──────────────────────────────────
 *
 * An earlier draft invoked PM2 by bare process names with `--env production`.
 * That is cosmetic: `--env` selects an `env_*` block from a PROCESS FILE, so
 * naming already-registered processes reuses PM2's STORED environment — the
 * exact mutable state that caused the incident. The guard would have verified
 * the operator typed "production" without the mutation consuming
 * `env_production` at all.
 *
 * Verified against the installed PM2 (6.0.14) in an isolated `PM2_HOME` fixture
 * with two plain apps and one `cron_restart` app:
 *
 *   reload <name> --env production                  → errored; marker stayed
 *                                                     STALE (ecosystem not read)
 *   reload <ecosystem> --only a,b --env production  → marker UPDATED from
 *                                                     env_production, and the
 *                                                     cron entry outside the
 *                                                     --only set did NOT start
 *   start  <ecosystem> --only c   --env production  → started exactly c
 *
 * So `--only` IS honoured for `reload` on this version and does not start apps
 * outside the selector. That is what makes the environment guarantee real while
 * preserving the exact-target-set property.
 *
 * ─── Enforcement boundary (stated, not implied) ─────────────────────────────
 *
 * This guards the COOPERATIVE deployment path. A root or non-interactive actor
 * can still call `pm2` directly and bypass it entirely — which is exactly what
 * happened on 2026-08-12. B1 (config-drift-detector) remains the DETECTION
 * backstop for that case; it caught the dev-mode regression within seconds.
 * Nothing here should be described as preventing a deliberate bypass.
 */

export type AppClass =
  | 'app-service'
  | 'ops-cron'
  | 'agent-cron'
  | 'hermes-cron'
  | 'maintenance-cron';

export type Operation = 'app-reload' | 'app-start';

/** The class an operation is permitted to touch. */
export const ALLOWED_CLASS: Record<Operation, AppClass> = {
  'app-reload': 'app-service',
  'app-start': 'app-service',
};

export interface EcosystemAppSummary {
  name: string;
  /** Present ⇒ PM2 treats it as a scheduled job. */
  cronRestart?: string;
}

export interface TargetRow {
  name: string;
  appClass: AppClass | 'UNCLASSIFIED';
  registered: boolean;
}

export interface GuardDecision {
  verdict: 'PASS' | 'REFUSE';
  operation: Operation;
  environment: string;
  targets: TargetRow[];
  /** Every reason the operation was refused. Empty on PASS. */
  refusals: string[];
  /**
   * The exact `--only` selector. Empty unless PASS.
   *
   * For `app-reload` this is every registered app-service. For `app-start` it
   * is ONLY the missing ones — starting an already-registered service would be
   * an implicit reload wearing a different name.
   */
  invokeNames: string[];
}

/**
 * Classify every ecosystem app from the DECLARED manifest.
 *
 * An app missing from the manifest is `UNCLASSIFIED` and will refuse any
 * operation. Fail-closed is the point: a newly added app must be classified
 * deliberately, not absorbed by a default.
 */
export function classifyApps(
  apps: EcosystemAppSummary[],
  manifest: Record<string, string>,
): Map<string, AppClass | 'UNCLASSIFIED'> {
  const valid: AppClass[] = ['app-service', 'ops-cron', 'agent-cron', 'hermes-cron', 'maintenance-cron'];
  const out = new Map<string, AppClass | 'UNCLASSIFIED'>();
  for (const app of apps) {
    const declared = manifest[app.name];
    out.set(app.name, valid.includes(declared as AppClass) ? (declared as AppClass) : 'UNCLASSIFIED');
  }
  return out;
}

/**
 * Cross-check declared classes against the structural evidence PM2 itself acts
 * on: a long-running service has no `cron_restart`, a scheduled job has one.
 *
 * This is what catches a mislabelled entry — declaring `ops-db-maintainer` as
 * `app-service` would otherwise let a deploy reload it, which is precisely the
 * side effect B2b exists to stop.
 */
export function findClassInconsistencies(
  apps: EcosystemAppSummary[],
  manifest: Record<string, string>,
): string[] {
  const problems: string[] = [];
  for (const app of apps) {
    const declared = manifest[app.name];
    if (!declared) continue; // coverage is a separate check
    const hasCron = Boolean(app.cronRestart);
    if (declared === 'app-service' && hasCron) {
      problems.push(`${app.name} is declared app-service but has cron_restart='${app.cronRestart}'`);
    }
    if (declared !== 'app-service' && !hasCron) {
      problems.push(`${app.name} is declared ${declared} but has no cron_restart`);
    }
  }
  return problems;
}

/**
 * Decide whether an operation may proceed, and on exactly which names.
 *
 * `registered` is the set of app names PM2 currently manages. It matters
 * because `app-reload` must operate on already-registered processes only — an
 * absent service is a DIFFERENT operation (`app-start`) that deserves a human
 * decision, not an implicit start folded into a routine deploy.
 */
export function evaluateOperation(input: {
  operation: Operation;
  environment: string;
  apps: EcosystemAppSummary[];
  manifest: Record<string, string>;
  registered: string[];
}): GuardDecision {
  const { operation, environment, apps, manifest, registered } = input;
  const classified = classifyApps(apps, manifest);
  const registeredSet = new Set(registered);
  const allowed = ALLOWED_CLASS[operation];

  // Rows cover the allowed class plus anything unclassified, so an unclassified
  // app is VISIBLE in the report rather than silently filtered out of it.
  const targets: TargetRow[] = apps
    .filter(a => {
      const c = classified.get(a.name);
      return c === allowed || c === 'UNCLASSIFIED';
    })
    .map(a => ({
      name: a.name,
      appClass: classified.get(a.name) ?? 'UNCLASSIFIED',
      registered: registeredSet.has(a.name),
    }));

  const refusals: string[] = [];

  if (environment !== 'production') {
    refusals.push(
      `environment is '${environment}', not 'production' — PM2 would apply each app's ` +
      `default env block (NODE_ENV=development), which on 2026-08-12 put production ` +
      `into development mode`,
    );
  }

  // Any app the manifest does not classify blocks every operation.
  const unclassified = [...classified.entries()].filter(([, c]) => c === 'UNCLASSIFIED').map(([n]) => n);
  if (unclassified.length > 0) {
    refusals.push(
      `unclassified app(s) in ecosystem.config.js: ${unclassified.join(', ')} — ` +
      `add them to deploy/pm2-app-classes.json before any guarded operation`,
    );
  }

  // Structural disagreement means the manifest cannot be trusted for this run.
  const inconsistencies = findClassInconsistencies(apps, manifest);
  if (inconsistencies.length > 0) {
    refusals.push(`class/config inconsistency: ${inconsistencies.join('; ')}`);
  }

  const intended = targets.filter(t => t.appClass === allowed);

  if (intended.length === 0) {
    refusals.push(`no ${allowed} targets resolved — refusing to invoke PM2 with an empty set`);
  }

  if (operation === 'app-reload') {
    const absent = intended.filter(t => !t.registered).map(t => t.name);
    if (absent.length > 0) {
      refusals.push(
        `expected app-service(s) not registered in PM2: ${absent.join(', ')} — ` +
        `a reload must not implicitly start a missing service; use app-start explicitly`,
      );
    }
  }

  if (operation === 'app-start') {
    const already = intended.filter(t => t.registered).map(t => t.name);
    if (already.length === intended.length) {
      refusals.push(
        `every app-service is already registered — app-start would be a no-op or an ` +
        `implicit reload; use app-reload`,
      );
    }
  }

  // Anything registered under an allowed-class name that the ecosystem does not
  // declare would be an implicitly introduced target.
  const ecosystemNames = new Set(apps.map(a => a.name));
  const strays = registered.filter(n => !ecosystemNames.has(n) && manifest[n] === allowed);
  if (strays.length > 0) {
    refusals.push(`target(s) registered in PM2 but absent from ecosystem.config.js: ${strays.join(', ')}`);
  }

  const verdict = refusals.length === 0 ? 'PASS' : 'REFUSE';

  // app-start acts ONLY on what is missing; app-reload on what is registered.
  const toInvoke = operation === 'app-start'
    ? intended.filter(t => !t.registered)
    : intended;

  return {
    verdict,
    operation,
    environment,
    targets: intended,
    refusals,
    invokeNames: verdict === 'PASS' ? toInvoke.map(t => t.name) : [],
  };
}

/**
 * Build the exact PM2 argv.
 *
 * The ecosystem file is the FIRST argument because `--env` only selects an
 * `env_*` block from a process file — naming registered processes instead
 * reuses PM2's stored environment (proven in the fixture, see the module
 * docblock). `--only` then constrains the mutation to the resolved set, which
 * is what stops PM2 starting cron entries that merely exist in the file.
 *
 * Returns null unless the decision passed, so a refusal has no executable form.
 */
export function buildPm2Argv(decision: GuardDecision, ecosystemPath: string): string[] | null {
  if (decision.verdict !== 'PASS' || decision.invokeNames.length === 0) return null;
  const verb = decision.operation === 'app-reload' ? 'reload' : 'start';
  return [
    verb,
    ecosystemPath,
    '--only', decision.invokeNames.join(','),
    '--env', decision.environment,
  ];
}

/** Human-readable pre-mutation report. Printed BEFORE PM2 is ever invoked. */
export function renderReport(decision: GuardDecision, dryRun: boolean, ecosystemPath = 'ecosystem.config.js'): string {
  const lines: string[] = [];
  lines.push(`requested operation: ${decision.operation}${dryRun ? ' (DRY RUN)' : ''}`);
  lines.push(`environment: ${decision.environment}`);
  lines.push('');
  lines.push('resolved targets:');
  if (decision.targets.length === 0) {
    lines.push('  (none)');
  } else {
    const width = Math.max(...decision.targets.map(t => t.name.length));
    for (const t of decision.targets) {
      lines.push(
        `  ${t.name.padEnd(width)}  ${t.appClass.padEnd(16)}  ` +
        `${t.registered ? 'registered' : 'NOT REGISTERED'}`,
      );
    }
  }
  lines.push('');
  lines.push(`allowed class: ${ALLOWED_CLASS[decision.operation]}`);
  lines.push(
    decision.refusals.length === 0
      ? 'unexpected targets: none'
      : `refusals:\n${decision.refusals.map(r => `  - ${r}`).join('\n')}`,
  );
  lines.push('');
  lines.push(`VERDICT: ${decision.verdict}`);
  if (decision.verdict === 'PASS') {
    lines.push(
      dryRun
        ? `would invoke: pm2 ${decision.operation === 'app-reload' ? 'reload' : 'start'} ${decision.invokeNames.join(' ')} --env ${decision.environment}`
        : `invoking by explicit name: ${decision.invokeNames.join(' ')}`,
    );
  }
  return lines.join('\n');
}
