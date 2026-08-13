/**
 * B2b guarded PM2 operations — target resolution and refusal rules.
 *
 * Pins the acceptance matrix against BOTH synthetic cases and the real
 * ecosystem.config.js / deploy/pm2-app-classes.json, so the classification
 * cannot drift out of the config it describes.
 *
 * The failure this guards against, from 2026-08-12: one command
 * (`pm2 reload ecosystem.config.js --env production`) reloaded the 3 app
 * services, STARTED ops-db-maintainer (real VACUUM on prod) and RE-REGISTERED
 * a deliberately deleted ops-config-drift-detector cron entry. Earlier the same
 * hour the same command without `--env production` put production into
 * development mode.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_CLASS,
  buildPm2Argv,
  classifyApps,
  evaluateOperation,
  findClassInconsistencies,
  renderReport,
  type EcosystemAppSummary,
} from './pm2-guard.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const require = createRequire(import.meta.url);

function loadRealApps(): EcosystemAppSummary[] {
  const config = require(join(repoRoot, 'ecosystem.config.js')) as {
    apps?: { name: string; cron_restart?: string }[];
  };
  return (config.apps ?? []).map(a => ({ name: a.name, cronRestart: a.cron_restart }));
}

function loadRealManifest(): Record<string, string> {
  const raw = readFileSync(join(repoRoot, 'deploy', 'pm2-app-classes.json'), 'utf-8');
  return (JSON.parse(raw) as { classes: Record<string, string> }).classes;
}

const APP_SERVICES = ['vizora-middleware', 'vizora-realtime', 'vizora-web'];

/** Synthetic fixture mirroring the real shape: 3 services + 2 cron jobs. */
const FIXTURE_APPS: EcosystemAppSummary[] = [
  { name: 'vizora-middleware' },
  { name: 'vizora-realtime' },
  { name: 'vizora-web' },
  { name: 'ops-db-maintainer', cronRestart: '0 3 * * *' },
  { name: 'ops-config-drift-detector', cronRestart: '0 * * * *' },
];

const FIXTURE_MANIFEST: Record<string, string> = {
  'vizora-middleware': 'app-service',
  'vizora-realtime': 'app-service',
  'vizora-web': 'app-service',
  'ops-db-maintainer': 'ops-cron',
  'ops-config-drift-detector': 'ops-cron',
};

function reload(over: Partial<Parameters<typeof evaluateOperation>[0]> = {}) {
  return evaluateOperation({
    operation: 'app-reload',
    environment: 'production',
    apps: FIXTURE_APPS,
    manifest: FIXTURE_MANIFEST,
    registered: [...APP_SERVICES, 'ops-db-maintainer'],
    ...over,
  });
}

// ─── Classification is authoritative, not inferred ───────────────────────────

test('every ecosystem app is classified — adding one without a class fails here', () => {
  const apps = loadRealApps();
  const manifest = loadRealManifest();
  const missing = apps.map(a => a.name).filter(n => !(n in manifest));
  assert.deepEqual(
    missing, [],
    `unclassified app(s): ${missing.join(', ')}. Add them to deploy/pm2-app-classes.json — ` +
    'the guard refuses to operate while any app is unclassified.',
  );
  assert.equal(apps.length, 18, 'ecosystem app count changed — re-verify the classification');
});

test('the manifest contains no entry that is not in the ecosystem', () => {
  const names = new Set(loadRealApps().map(a => a.name));
  const strays = Object.keys(loadRealManifest()).filter(n => !names.has(n));
  assert.deepEqual(strays, [], `stale manifest entr(y/ies): ${strays.join(', ')}`);
});

test('declared classes agree with the structural evidence PM2 itself acts on', () => {
  // app-service ⇒ no cron_restart; *-cron ⇒ has cron_restart. This is what
  // catches a mislabelled entry, e.g. db-maintainer declared app-service.
  assert.deepEqual(findClassInconsistencies(loadRealApps(), loadRealManifest()), []);
});

test('exactly the three long-running services are app-service', () => {
  const manifest = loadRealManifest();
  const declared = Object.entries(manifest).filter(([, c]) => c === 'app-service').map(([n]) => n).sort();
  assert.deepEqual(declared, [...APP_SERVICES].sort());
});

test('a mislabelled cron job is caught structurally', () => {
  const problems = findClassInconsistencies(
    FIXTURE_APPS,
    { ...FIXTURE_MANIFEST, 'ops-db-maintainer': 'app-service' },
  );
  assert.ok(problems.some(p => /ops-db-maintainer.*app-service.*cron_restart/.test(p)));
});

test('an unclassified app is UNCLASSIFIED, never defaulted', () => {
  const classified = classifyApps(FIXTURE_APPS, { 'vizora-middleware': 'app-service' });
  assert.equal(classified.get('vizora-middleware'), 'app-service');
  assert.equal(classified.get('ops-db-maintainer'), 'UNCLASSIFIED');
});

test('an invalid class string is treated as UNCLASSIFIED', () => {
  const classified = classifyApps(FIXTURE_APPS, { ...FIXTURE_MANIFEST, 'vizora-web': 'whatever' });
  assert.equal(classified.get('vizora-web'), 'UNCLASSIFIED');
});

// ─── Acceptance matrix ───────────────────────────────────────────────────────

test('ALLOW: exact registered app-service set in production', () => {
  const d = reload();
  assert.equal(d.verdict, 'PASS', d.refusals.join('; '));
  assert.deepEqual(d.invokeNames.sort(), [...APP_SERVICES].sort());
});

test('REFUSE: environment is not production', () => {
  for (const environment of ['development', 'staging', '']) {
    const d = reload({ environment });
    assert.equal(d.verdict, 'REFUSE');
    assert.ok(d.refusals.some(r => /not 'production'/.test(r)));
    assert.deepEqual(d.invokeNames, [], 'a refused operation must expose no names to invoke');
  }
});

test('REFUSE: an expected app-service is absent from PM2 — no implicit start', () => {
  const d = reload({ registered: ['vizora-middleware', 'vizora-realtime'] });
  assert.equal(d.verdict, 'REFUSE');
  assert.ok(d.refusals.some(r => /not registered in PM2: vizora-web/.test(r)));
  assert.ok(d.refusals.some(r => /use app-start explicitly/.test(r)));
});

test('REFUSE: any unclassified app blocks the whole operation', () => {
  const d = reload({
    apps: [...FIXTURE_APPS, { name: 'brand-new-thing', cronRestart: '* * * * *' }],
  });
  assert.equal(d.verdict, 'REFUSE');
  assert.ok(d.refusals.some(r => /unclassified app\(s\).*brand-new-thing/.test(r)));
});

test('REFUSE: a class/config inconsistency blocks the operation', () => {
  const d = reload({ manifest: { ...FIXTURE_MANIFEST, 'ops-db-maintainer': 'app-service' } });
  assert.equal(d.verdict, 'REFUSE');
  assert.ok(d.refusals.some(r => /inconsistency/.test(r)));
});

test('REFUSE: a target registered in PM2 but absent from the ecosystem', () => {
  const d = reload({
    registered: [...APP_SERVICES, 'vizora-ghost'],
    manifest: { ...FIXTURE_MANIFEST, 'vizora-ghost': 'app-service' },
  });
  assert.equal(d.verdict, 'REFUSE');
  assert.ok(d.refusals.some(r => /absent from ecosystem\.config\.js: vizora-ghost/.test(r)));
});

test('REFUSE: an empty target set never invokes PM2', () => {
  const d = reload({ apps: FIXTURE_APPS.filter(a => a.cronRestart), manifest: FIXTURE_MANIFEST });
  assert.equal(d.verdict, 'REFUSE');
  assert.ok(d.refusals.some(r => /empty set/.test(r)));
});

// ─── The 2026-08-12 side effects, pinned ─────────────────────────────────────

test('app-reload NEVER resolves a cron/maintenance target', () => {
  const d = reload();
  assert.equal(d.verdict, 'PASS');
  assert.ok(!d.invokeNames.includes('ops-db-maintainer'), 'this ran a real VACUUM on prod');
  assert.ok(!d.invokeNames.includes('ops-config-drift-detector'), 'this resurrected a deleted cron entry');
  assert.ok(d.targets.every(t => t.appClass === 'app-service'));
});

test('a deregistered cron entry cannot be resurrected by a reload', () => {
  // ops-config-drift-detector was deliberately `pm2 delete`d and came back.
  const d = reload({ registered: APP_SERVICES });
  assert.equal(d.verdict, 'PASS');
  assert.ok(!d.invokeNames.includes('ops-config-drift-detector'));
});

test('the mutation references the ecosystem file — that is what applies env_production', () => {
  // Verified on PM2 6.0.14: `reload <name> --env production` does NOT re-read the
  // ecosystem file, so env_production is never consumed and PM2 reuses its stored
  // env. Only an ecosystem-file invocation makes the environment guarantee real.
  const argv = buildPm2Argv(reload(), '/opt/vizora/app/ecosystem.config.js');
  assert.ok(argv, 'a passing decision must be executable');
  assert.equal(argv[0], 'reload');
  assert.equal(argv[1], '/opt/vizora/app/ecosystem.config.js');
  assert.ok(argv.includes('--env'));
  assert.equal(argv[argv.indexOf('--env') + 1], 'production');
});

test('the --only selector contains exactly the app services and no cron names', () => {
  const argv = buildPm2Argv(reload(), 'ecosystem.config.js');
  const only = argv![argv!.indexOf('--only') + 1].split(',');
  assert.deepEqual(only.sort(), [...APP_SERVICES].sort());
  assert.ok(!only.some(n => /cron|db-maintainer|hermes|agent-/.test(n)));
});

test('a refused decision has no executable form at all', () => {
  assert.equal(buildPm2Argv(reload({ environment: 'staging' }), 'ecosystem.config.js'), null);
});

test('app-start invokes ONLY the missing service when one is absent', () => {
  const d = evaluateOperation({
    operation: 'app-start',
    environment: 'production',
    apps: FIXTURE_APPS,
    manifest: FIXTURE_MANIFEST,
    registered: ['vizora-middleware', 'vizora-realtime'],
  });
  assert.equal(d.verdict, 'PASS', d.refusals.join('; '));
  assert.deepEqual(d.invokeNames, ['vizora-web'], 'must not restart the two healthy services');

  const argv = buildPm2Argv(d, 'ecosystem.config.js');
  assert.equal(argv![argv!.indexOf('--only') + 1], 'vizora-web');
  assert.equal(argv![0], 'start');
});

test('app-start invokes exactly the two missing services when two are absent', () => {
  const d = evaluateOperation({
    operation: 'app-start',
    environment: 'production',
    apps: FIXTURE_APPS,
    manifest: FIXTURE_MANIFEST,
    registered: ['vizora-middleware'],
  });
  assert.equal(d.verdict, 'PASS', d.refusals.join('; '));
  assert.deepEqual(d.invokeNames.sort(), ['vizora-realtime', 'vizora-web']);

  const argv = buildPm2Argv(d, 'ecosystem.config.js');
  const only = argv![argv!.indexOf('--only') + 1].split(',').sort();
  assert.deepEqual(only, ['vizora-realtime', 'vizora-web']);
  assert.ok(!only.includes('vizora-middleware'), 'a registered service must not be restarted by app-start');
});

test('app-reload invokes every registered app service', () => {
  const d = reload();
  assert.deepEqual(d.invokeNames.sort(), [...APP_SERVICES].sort());
});

test('against the REAL ecosystem, app-reload resolves exactly the three services', () => {
  const d = evaluateOperation({
    operation: 'app-reload',
    environment: 'production',
    apps: loadRealApps(),
    manifest: loadRealManifest(),
    registered: loadRealApps().map(a => a.name),
  });
  assert.equal(d.verdict, 'PASS', d.refusals.join('; '));
  assert.deepEqual(d.invokeNames.sort(), [...APP_SERVICES].sort());
  assert.equal(d.targets.length, 3, 'all 15 cron entries must be excluded');
});

// ─── app-start is a distinct operation ───────────────────────────────────────

test('app-start allows starting a genuinely missing service', () => {
  const d = evaluateOperation({
    operation: 'app-start',
    environment: 'production',
    apps: FIXTURE_APPS,
    manifest: FIXTURE_MANIFEST,
    registered: ['vizora-middleware', 'vizora-realtime'],
  });
  assert.equal(d.verdict, 'PASS', d.refusals.join('; '));
});

test('app-start refuses when everything is already registered', () => {
  const d = evaluateOperation({
    operation: 'app-start',
    environment: 'production',
    apps: FIXTURE_APPS,
    manifest: FIXTURE_MANIFEST,
    registered: [...APP_SERVICES],
  });
  assert.equal(d.verdict, 'REFUSE');
  assert.ok(d.refusals.some(r => /use app-reload/.test(r)));
});

test('both operations allow only app-service', () => {
  assert.deepEqual(ALLOWED_CLASS, { 'app-reload': 'app-service', 'app-start': 'app-service' });
});

// ─── Report is emitted before mutation ───────────────────────────────────────

test('the report names every target, its class and registration state', () => {
  const report = renderReport(reload(), false, 'ecosystem.config.js');
  for (const name of APP_SERVICES) assert.match(report, new RegExp(name));
  assert.match(report, /app-service/);
  assert.match(report, /registered/);
  assert.match(report, /allowed class: app-service/);
  assert.match(report, /VERDICT: PASS/);
});

test('the rendered command is EXACTLY buildPm2Argv — never a reconstructed string', () => {
  // Dry-run is the pre-production proof. If the report built its own command
  // string it could confidently display an invocation different from the one
  // that executes — the same "displayed config is not consumed config" failure
  // this whole workstream exists to remove.
  for (const dryRun of [true, false]) {
    const d = reload();
    const argv = buildPm2Argv(d, '/opt/vizora/app/ecosystem.config.js');
    const report = renderReport(d, dryRun, '/opt/vizora/app/ecosystem.config.js');
    assert.ok(
      report.includes(`pm2 ${argv!.join(' ')}`),
      `report must contain the exact argv it will execute.\nargv:   pm2 ${argv!.join(' ')}\nreport:\n${report}`,
    );
  }
});

test('the report distinguishes the evaluated set from the mutation target set', () => {
  const d = evaluateOperation({
    operation: 'app-start',
    environment: 'production',
    apps: FIXTURE_APPS,
    manifest: FIXTURE_MANIFEST,
    registered: ['vizora-middleware', 'vizora-realtime'],
  });
  const report = renderReport(d, true, 'ecosystem.config.js');

  // Evaluated set shows all three with their registration state...
  assert.match(report, /evaluated app-service set:/);
  assert.match(report, /vizora-middleware\s+app-service\s+registered/);
  assert.match(report, /vizora-web\s+app-service\s+NOT REGISTERED/);

  // ...but the mutation set and command contain ONLY the missing service.
  const mutationSection = report.slice(report.indexOf('mutation target set:'), report.indexOf('allowed class:'));
  assert.match(mutationSection, /vizora-web/);
  assert.doesNotMatch(mutationSection, /vizora-middleware/);
  assert.doesNotMatch(mutationSection, /vizora-realtime/);
  assert.match(report, /--only vizora-web /);
});

test('app-start with two missing renders exactly those two in the command', () => {
  const d = evaluateOperation({
    operation: 'app-start',
    environment: 'production',
    apps: FIXTURE_APPS,
    manifest: FIXTURE_MANIFEST,
    registered: ['vizora-middleware'],
  });
  const report = renderReport(d, true, 'ecosystem.config.js');
  const only = buildPm2Argv(d, 'ecosystem.config.js')![3].split(',').sort();
  assert.deepEqual(only, ['vizora-realtime', 'vizora-web']);
  assert.match(report, /--only vizora-(realtime,vizora-web|web,vizora-realtime) /);
});

test('app-reload renders exactly the three services in the command', () => {
  const report = renderReport(reload(), true, 'ecosystem.config.js');
  assert.match(report, /--only vizora-middleware,vizora-realtime,vizora-web /);
  assert.match(report, /ecosystem\.config\.js/);
});

test('a refusal report states every reason and prints NO executable command', () => {
  const report = renderReport(reload({ environment: 'staging' }), false, 'ecosystem.config.js');
  assert.match(report, /VERDICT: REFUSE/);
  assert.match(report, /refusals:/);
  assert.doesNotMatch(report, /exact command:/);
  assert.doesNotMatch(report, /pm2 reload/);
});

test('dry-run marks the command as not executed', () => {
  const report = renderReport(reload(), true, 'ecosystem.config.js');
  assert.match(report, /DRY RUN/);
  assert.match(report, /exact command:/);
  assert.match(report, /\(dry run — not executed\)/);
});

// ─── B3 wiring coverage ──────────────────────────────────────────────────────

test('every app-service has a startup-assertion validator mapping', async () => {
  // An app-service absent from SERVICE_BY_APP would be reloaded with NOTHING
  // asserted about it. deploy/pm2-app-classes.json already has a coverage test;
  // this is its mirror for the assertion side.
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const opsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const repoRoot = join(opsDir, '..', '..');
  const classes = JSON.parse(
    readFileSync(join(repoRoot, 'deploy', 'pm2-app-classes.json'), 'utf-8'),
  ).classes as Record<string, string>;
  const guardSource = readFileSync(join(opsDir, 'pm2-guard.ts'), 'utf-8');

  const appServices = Object.entries(classes)
    .filter(([, cls]) => cls === 'app-service')
    .map(([name]) => name);

  assert.ok(appServices.length > 0, 'no app-services found — the check would be vacuous');
  const unmapped = appServices.filter(n => !guardSource.includes(`'${n}': '`));
  assert.deepEqual(unmapped, [], 'app-services missing from SERVICE_BY_APP');
});

// ─── D1: per-service cwd resolution (the repair itself) ──────────────────────

test('each service reads ITS OWN cwd/.env, not the repo root', async () => {
  // THE D1 REGRESSION GUARD. Prod hides this: middleware/.env and realtime/.env
  // are symlinks to the root file, so the buggy and fixed resolutions read
  // identical bytes there. Only a layout where <cwd>/.env differs from
  // <root>/.env discriminates — so build one.
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { readServiceDotenv, serviceCwdFor } = await import('./config-drift.js');

  const root = mkdtempSync(join(tmpdir(), 'vizora-cwd-'));
  try {
    writeFileSync(join(root, '.env'), 'WHICH_FILE=root\n');
    mkdirSync(join(root, 'middleware'));
    writeFileSync(join(root, 'middleware', '.env'), 'WHICH_FILE=service\nONLY_IN_SERVICE=1\n');
    mkdirSync(join(root, 'web'));

    const mwCwd = serviceCwdFor(root, 'middleware', './middleware');
    const mw = readServiceDotenv(mwCwd);
    assert.equal(mw?.WHICH_FILE, 'service', 'must read the service file, not the repo root');
    assert.equal(mw?.ONLY_IN_SERVICE, '1');

    // web has no .env — null, NOT an empty object and NOT the root file.
    assert.equal(readServiceDotenv(serviceCwdFor(root, 'web', './web')), null);

    // No cwd in the ecosystem entry falls back to <root>/<service>.
    assert.equal(serviceCwdFor(root, 'middleware', undefined), join(root, 'middleware'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SERVICE_BY_APP maps every app-service to a DISTINCT valid service', async () => {
  // The previous version grepped the source for the key, so `'vizora-realtime':
  // 'middleware'` passed while realtime vanished from the report entirely.
  const { SERVICE_BY_APP } = await import('../pm2-guard.js');
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const classes = JSON.parse(
    readFileSync(join(repoRoot, 'deploy', 'pm2-app-classes.json'), 'utf-8'),
  ).classes as Record<string, string>;
  const appServices = Object.entries(classes)
    .filter(([, c]) => c === 'app-service')
    .map(([n]) => n);

  assert.ok(appServices.length > 0);
  const mapped = appServices.map(n => SERVICE_BY_APP[n]);
  assert.deepEqual(mapped.filter(Boolean).length, appServices.length, 'every app-service mapped');
  assert.equal(new Set(mapped).size, mapped.length, 'mappings must be distinct');
  for (const s of mapped) assert.ok(['middleware', 'realtime', 'web'].includes(s!), `bad: ${s}`);
});

test('readPersistedConfigs itself reads each service cwd — pins the D1 repair', async () => {
  // Testing serviceCwdFor/readServiceDotenv in isolation was not enough: a
  // mutation setting `serviceCwd = REPO_ROOT` inside readPersistedConfigs
  // survived, which is D1 verbatim. This exercises the repaired line.
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { readPersistedConfigs } = await import('../pm2-guard.js');

  const root = mkdtempSync(join(tmpdir(), 'vizora-rpc-'));
  try {
    writeFileSync(join(root, '.env'), 'WHICH_FILE=root\n');
    mkdirSync(join(root, 'middleware'));
    writeFileSync(join(root, 'middleware', '.env'), 'WHICH_FILE=service\n');
    mkdirSync(join(root, 'web'));

    const apps = [
      { name: 'vizora-middleware', cwd: './middleware', env_production: { NODE_ENV: 'production' } },
      { name: 'vizora-web', cwd: './web', env_production: { NODE_ENV: 'production' } },
    ];
    const { configs, notes } = readPersistedConfigs(
      ['vizora-middleware', 'vizora-web'],
      apps,
      root,
    );

    const mw = configs.find(c => c.service === 'middleware');
    assert.equal(mw?.dotenvVars?.WHICH_FILE, 'service', 'must read middleware/.env, not the root');

    const web = configs.find(c => c.service === 'web');
    assert.equal(web?.dotenvVars, null, 'web has no .env and must not inherit the root one');

    assert.ok(notes.some(n => n.includes('middleware') && n.includes('loaded')));
    assert.ok(notes.some(n => n.includes('web') && n.includes('NOT FOUND')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
