/**
 * B2c — the web build-input manifest is enforced, not decorative.
 *
 * Runs in `pnpm test:ops`, which is CI-gated, so a newly consumed
 * `NEXT_PUBLIC_*` that nobody accounted for fails the build.
 *
 * The invariant that matters: a variable the BROWSER reads is resolved at
 * build time or not at all. Adding it to prod `.env` later changes only the
 * SSR process, silently. See lib/web-build-inputs.ts for the evidence.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkManifest,
  extractBuildStepValues,
  extractBuildStepVars,
  extractMetadataValues,
  extractMetadataVars,
  extractPublicVars,
  type BuildInputManifest,
} from './lib/web-build-inputs.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestPath = join(repoRoot, 'deploy', 'web-build-inputs.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as BuildInputManifest;
const workflow = readFileSync(join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');

/** Every NEXT_PUBLIC_* the web app actually reads. */
function consumedByWeb(): string[] {
  const found = new Set<string>();
  const skip = new Set(['node_modules', '.next', 'coverage', 'dist', '.turbo']);
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        for (const v of extractPublicVars(readFileSync(full, 'utf8'))) found.add(v);
      }
    }
  };
  walk(join(repoRoot, 'web'));
  return [...found].sort();
}

test('the manifest accounts for every NEXT_PUBLIC_* the web app consumes', () => {
  const consumed = consumedByWeb();
  const findings = checkManifest(
    manifest,
    consumed,
    extractBuildStepVars(workflow),
    extractMetadataVars(workflow),
    { buildStep: extractBuildStepValues(workflow), metadata: extractMetadataValues(workflow) },
  );
  assert.deepEqual(
    findings,
    [],
    findings.map(f => `${f.variable}: ${f.problem}`).join('\n'),
  );
});

test('the scan actually finds variables, so the check is not vacuous', () => {
  const consumed = consumedByWeb();
  assert.ok(consumed.length >= 5, `only found ${consumed.length}: ${consumed.join(', ')}`);
  assert.ok(consumed.includes('NEXT_PUBLIC_API_URL'));
  assert.ok(consumed.includes('NEXT_PUBLIC_GOOGLE_CLIENT_ID'));
});

test('build-metadata records exactly the declared CI inputs', () => {
  assert.deepEqual(extractMetadataVars(workflow).sort(), [
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_SOCKET_URL',
  ]);
});

test('the CI build step is read from its own env block, not the workflow default', () => {
  // The workflow-level env sets localhost values for the test jobs. Counting
  // those would report a production build input that does not exist.
  const stepVars = extractBuildStepVars(workflow);
  assert.deepEqual(stepVars.sort(), ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SOCKET_URL']);
});

// ─── The checker itself ──────────────────────────────────────────────────────

const BASE: BuildInputManifest = {
  variables: [
    {
      name: 'NEXT_PUBLIC_API_URL',
      consumedInClientBundle: true,
      consumedOnServer: true,
      buildInput: 'ci',
      productionValue: 'https://vizora.cloud',
      defaultIfAbsent: 'localhost',
      why: 'because',
    },
  ],
};
const CI_STEP = ['NEXT_PUBLIC_API_URL'];
const METADATA = ['NEXT_PUBLIC_API_URL'];

test('a newly consumed variable that nobody declared fails', () => {
  const f = checkManifest(BASE, ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_NEW_THING'], CI_STEP, METADATA);
  assert.equal(f.length, 1);
  assert.equal(f[0]?.variable, 'NEXT_PUBLIC_NEW_THING');
  assert.match(f[0]!.problem, /absent from deploy\/web-build-inputs\.json/);
});

test('a manifest entry with no consumer fails as stale', () => {
  const stale: BuildInputManifest = {
    variables: [
      ...BASE.variables,
      {
        name: 'NEXT_PUBLIC_GONE',
        consumedInClientBundle: true,
        consumedOnServer: false,
        buildInput: 'intentionally-unset',
        productionValue: null,
        defaultIfAbsent: 'n/a',
        why: 'x',
      },
    ],
  };
  const f = checkManifest(stale, ['NEXT_PUBLIC_API_URL'], CI_STEP, METADATA);
  assert.equal(f.length, 1);
  assert.match(f[0]!.problem, /no longer consumed/);
});

test('THE TRAP: a browser-read value that is not a build input fails', () => {
  // This is the Google Sign-In shape. Someone sets a real value expecting a
  // prod .env change to enable it; the SSR process sees it, the browser never
  // does, and nothing errors.
  const trap: BuildInputManifest = {
    variables: [
      {
        name: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
        consumedInClientBundle: true,
        consumedOnServer: false,
        buildInput: 'intentionally-unset',
        productionValue: 'real-id.apps.googleusercontent.com',
        defaultIfAbsent: 'button hidden',
        why: 'x',
      },
    ],
  };
  const f = checkManifest(trap, ['NEXT_PUBLIC_GOOGLE_CLIENT_ID'], [], []);
  assert.ok(f.some(x => /can never reach the client bundle/.test(x.problem)), JSON.stringify(f));
});

test('a declared CI input that the build step does not supply fails', () => {
  const f = checkManifest(BASE, ['NEXT_PUBLIC_API_URL'], [], METADATA);
  assert.ok(f.some(x => /does not supply it/.test(x.problem)), JSON.stringify(f));
});

test('a declared CI input missing from build-metadata.env fails', () => {
  const f = checkManifest(BASE, ['NEXT_PUBLIC_API_URL'], CI_STEP, []);
  assert.ok(f.some(x => /not recorded in build-metadata\.env/.test(x.problem)), JSON.stringify(f));
});

test('an intentionally-unset variable that CI actually supplies fails', () => {
  const contradiction: BuildInputManifest = {
    variables: [{ ...BASE.variables[0]!, buildInput: 'intentionally-unset', productionValue: null }],
  };
  const f = checkManifest(contradiction, ['NEXT_PUBLIC_API_URL'], CI_STEP, METADATA);
  assert.ok(f.some(x => /the manifest and the build disagree/.test(x.problem)), JSON.stringify(f));
});

test('an entry without a reason fails', () => {
  const noWhy: BuildInputManifest = {
    variables: [{ ...BASE.variables[0]!, why: '   ' }],
  };
  const f = checkManifest(noWhy, ['NEXT_PUBLIC_API_URL'], CI_STEP, METADATA);
  assert.ok(f.some(x => /missing `why`/.test(x.problem)), JSON.stringify(f));
});

test('extractPublicVars ignores prose and de-duplicates', () => {
  assert.deepEqual(extractPublicVars('NEXT_PUBLIC_A and NEXT_PUBLIC_A and NEXT_PUBLIC_B'), [
    'NEXT_PUBLIC_A',
    'NEXT_PUBLIC_B',
  ]);
  assert.deepEqual(extractPublicVars('the NEXT_PUBLIC_ prefix alone'), []);
});
