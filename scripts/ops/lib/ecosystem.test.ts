/**
 * Canonical PM2 memory policy — parsing and derivation.
 *
 * Pins the defect these functions exist to remove: `health-guardian` kept its
 * own copy of each service's memory limit and gracefully reloaded anything above
 * 85% of it. middleware's ecosystem limit was deliberately raised 512M → 640M to
 * STOP restart churn, but the copy stayed at 512M — so 85% remained 435MB
 * against a process idling near 400MB with spikes to ~455MB. Six reloads were
 * recorded on 2026-08-12 between 17:20 and 20:20, initially mistaken for
 * unexplained operator activity.
 */

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseMemoryLimit, readEcosystemMemoryPolicy } from './ecosystem.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MB = 1024 * 1024;

/** The threshold health-guardian applies. */
const RELOAD_ABOVE_PCT = 85;
function wouldReload(memoryBytes: number, limitBytes: number): boolean {
  return (memoryBytes / limitBytes) * 100 > RELOAD_ABOVE_PCT;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

test('parseMemoryLimit understands PM2 suffixes', () => {
  assert.equal(parseMemoryLimit('640M'), 640 * MB);
  assert.equal(parseMemoryLimit('512M'), 512 * MB);
  assert.equal(parseMemoryLimit('1G'), 1024 * MB);
  assert.equal(parseMemoryLimit('256K'), 256 * 1024);
  assert.equal(parseMemoryLimit('128'), 128);
  assert.equal(parseMemoryLimit(671088640), 671088640);
});

test('parseMemoryLimit is case- and whitespace-tolerant', () => {
  assert.equal(parseMemoryLimit('640m'), 640 * MB);
  assert.equal(parseMemoryLimit(' 640MB '), 640 * MB);
  assert.equal(parseMemoryLimit('1g'), 1024 * MB);
});

test('parseMemoryLimit returns null for anything unrecognised — never a default', () => {
  // Acting on a guessed threshold is the defect being removed.
  for (const bad of [undefined, null, '', 'lots', '640X', '-5M', '0', {}, []]) {
    assert.equal(parseMemoryLimit(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

// ─── Derivation from the real ecosystem file ────────────────────────────────

test('readEcosystemMemoryPolicy derives every app service limit from the canonical file', () => {
  const policy = readEcosystemMemoryPolicy();
  assert.equal(policy.error, undefined, `ecosystem must be readable: ${policy.error}`);

  assert.equal(policy.limits['vizora-middleware'], 640 * MB, 'middleware is 640M in ecosystem.config.js');
  assert.equal(policy.limits['vizora-realtime'], 512 * MB);
  assert.equal(policy.limits['vizora-web'], 1024 * MB);
});

test('an unreadable ecosystem yields no limits and a reason — never a substituted default', () => {
  const policy = readEcosystemMemoryPolicy(join(repoRoot, 'does-not-exist.config.js'));
  assert.deepEqual(policy.limits, {});
  assert.ok(policy.error, 'the caller must be able to tell derivation failed');
});

// ─── The threshold behaviour that caused the churn ──────────────────────────

test('450MB does NOT trigger a reload when the limit is 640M', () => {
  // Middleware's observed working set: 398-410MB idle, 447-455MB under load.
  const limit = readEcosystemMemoryPolicy().limits['vizora-middleware'];
  assert.equal(limit, 640 * MB);

  for (const mb of [398, 410, 447, 450, 455]) {
    assert.equal(
      wouldReload(mb * MB, limit), false,
      `${mb}MB must not trigger a reload against a 640M limit (85% = 544MB)`,
    );
  }
});

test('the stale 512M limit is exactly what made 450MB trigger', () => {
  // Regression anchor: this is the behaviour observed six times on 2026-08-12.
  assert.equal(wouldReload(450 * MB, 512 * MB), true, '450MB is 87.9% of 512M');
  assert.equal(wouldReload(447 * MB, 512 * MB), true);
});

test('above 85% of 640M DOES still trigger — the guard is not disabled', () => {
  const limit = readEcosystemMemoryPolicy().limits['vizora-middleware'];
  assert.equal(wouldReload(545 * MB, limit), true, '545MB is >85% of 640M');
  assert.equal(wouldReload(600 * MB, limit), true);
  assert.equal(wouldReload(544 * MB, limit), false, '544MB is exactly 85% — not above it');
});

test('other services keep their existing thresholds', () => {
  const limits = readEcosystemMemoryPolicy().limits;
  // realtime 512M: 85% = 435.2MB
  assert.equal(wouldReload(430 * MB, limits['vizora-realtime']), false);
  assert.equal(wouldReload(440 * MB, limits['vizora-realtime']), true);
  // web 1G: 85% = 870.4MB
  assert.equal(wouldReload(800 * MB, limits['vizora-web']), false);
  assert.equal(wouldReload(900 * MB, limits['vizora-web']), true);
});

test('no service limit is duplicated as an independent constant in health-guardian', async () => {
  // The structural guarantee: the agent must DERIVE limits, not hold copies that
  // can drift out of the canonical file again.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(join(repoRoot, 'scripts', 'ops', 'health-guardian.ts'), 'utf-8');

  assert.match(source, /readEcosystemMemoryPolicy\(\)/, 'health-guardian must derive the policy');
  assert.ok(
    !/memoryLimitBytes:\s*\d+\s*\*/.test(source),
    'health-guardian must not hardcode a memoryLimitBytes value',
  );
});
