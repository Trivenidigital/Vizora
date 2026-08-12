/**
 * B2 — every app in the canonical production reload must have a DECIDED
 * environment posture.
 *
 * On 2026-08-12 all three application services were restarted without
 * `--env production`, so PM2 applied each app's default `env` block
 * (`NODE_ENV: 'development'`). Production ran in development mode: both boot
 * validators skipped, rate limits at the 100x-relaxed dev tier, and Swagger
 * publicly reachable at `/api/v1/docs` until it was caught.
 *
 * The reload that fixed it printed:
 *
 *     [PM2][WARN] Environment [production] is not defined in process file
 *
 * three times — for apps that legitimately do not use PM2-injected env. That is
 * the danger this test addresses: when a canonical production command routinely
 * prints warnings that are known-benign, operators stop reading them, and a
 * warning that actually matters arrives into a channel nobody trusts. It is the
 * same failure shape as `Vacuum: 0 OK, 7 failed` running daily unnoticed.
 *
 * The invariant: an app either declares `env_production`, or it appears below
 * with a written reason. Silence is not an option for either.
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

interface EcosystemApp {
  name: string;
  env?: Record<string, unknown>;
  env_production?: Record<string, unknown>;
}

function loadApps(): EcosystemApp[] {
  const config = require(join(repoRoot, 'ecosystem.config.js')) as { apps?: EcosystemApp[] };
  return config.apps ?? [];
}

/**
 * Apps that intentionally do NOT define `env_production`, each with the reason
 * it is safe. Adding a name here is a deliberate, reviewable act — which is the
 * entire point. Do not add an app merely to silence this test.
 *
 * All three read their own configuration and never consult PM2-injected
 * `NODE_ENV`:
 *
 *   - the two skill runners execute `scripts/agents/hermes/run-hermes-skill.sh`,
 *     which reads keys straight out of `/opt/vizora/app/.env` (see its comment
 *     at line 51: "PM2 doesn't auto-source .env files"). It deliberately avoids
 *     `source` because values contain shell-special characters — the same
 *     unquoted-`&`-in-DATABASE_URL trap the B1 investigation documented.
 *   - `hermes-insights-poller` runs a tsx script using `import 'dotenv/config'`
 *     and reads only `MIDDLEWARE_URL` / `INTERNAL_API_SECRET`.
 */
const INTENTIONALLY_DEFAULT_ENV: Record<string, string> = {
  'hermes-vizora-customer-lifecycle':
    'runs run-hermes-skill.sh, which reads /opt/vizora/app/.env directly; never reads NODE_ENV',
  'hermes-vizora-support-triage':
    'runs run-hermes-skill.sh, which reads /opt/vizora/app/.env directly; never reads NODE_ENV',
  'hermes-insights-poller':
    "tsx script using import 'dotenv/config'; reads MIDDLEWARE_URL / INTERNAL_API_SECRET only",
};

test('every ecosystem app either declares env_production or is documented as default-env', () => {
  const undecided = loadApps()
    .filter(a => !a.env_production)
    .map(a => a.name)
    .filter(name => !(name in INTENTIONALLY_DEFAULT_ENV));

  assert.deepEqual(
    undecided,
    [],
    `apps with no env_production and no documented exemption: ${undecided.join(', ')}. ` +
    'Add env_production, or add an entry to INTENTIONALLY_DEFAULT_ENV explaining why the ' +
    'default env block is correct for it.',
  );
});

test('every declared env_production sets NODE_ENV=production', () => {
  const wrong = loadApps()
    .filter(a => a.env_production)
    .filter(a => a.env_production!.NODE_ENV !== 'production')
    .map(a => `${a.name} (NODE_ENV=${String(a.env_production!.NODE_ENV)})`);

  assert.deepEqual(
    wrong,
    [],
    `env_production blocks that do not set NODE_ENV=production: ${wrong.join(', ')}`,
  );
});

test('the exemption list stays honest — no stale entries', () => {
  // An app that has since gained env_production must be removed from the list,
  // otherwise the list drifts into a pile of names nobody re-reads.
  const apps = loadApps();
  const stale = Object.keys(INTENTIONALLY_DEFAULT_ENV).filter(name => {
    const app = apps.find(a => a.name === name);
    return !app || !!app.env_production;
  });

  assert.deepEqual(
    stale,
    [],
    `exempted apps that no longer need the exemption (or no longer exist): ${stale.join(', ')}`,
  );
});

test('every exemption carries a non-trivial written reason', () => {
  for (const [name, reason] of Object.entries(INTENTIONALLY_DEFAULT_ENV)) {
    assert.ok(
      reason.length > 30,
      `exemption for ${name} needs a real reason, not a placeholder`,
    );
  }
});

test('the three app services declare a production block — the 2026-08-12 regression', () => {
  // These are the services that ran in development mode in production. Their
  // env_production blocks are what `--env production` selects; without the
  // flag PM2 applies `env`, which sets NODE_ENV=development on all three.
  const apps = loadApps();
  for (const name of ['vizora-middleware', 'vizora-realtime', 'vizora-web']) {
    const app = apps.find(a => a.name === name);
    assert.ok(app, `${name} missing from ecosystem`);
    assert.equal(app.env_production?.NODE_ENV, 'production', `${name} env_production`);
    assert.equal(
      app.env?.NODE_ENV,
      'development',
      `${name} default env block is the development block — this is why the canonical ` +
      'production command MUST pass --env production',
    );
  }
});
