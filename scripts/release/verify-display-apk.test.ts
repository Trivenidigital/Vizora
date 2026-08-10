/**
 * Release gate — pinned canonical signing-certificate check.
 *
 * This is the check that protects the FIRST publish. The `published` baseline
 * in release.json only exists from release 2 onward, and release 1 is exactly
 * where the 2026-08-10 mismatch was found: the sole release APK (1.3.10) was
 * signed with a certificate that is not present on the build machine.
 *
 * These tests pin the fail-closed behaviour so a future refactor cannot quietly
 * turn "no canonical key pinned" back into a pass.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluatePinnedCert, normalizeFingerprint, formatFingerprint } from './verify-display-apk.mjs';

// Real fingerprints from the 2026-08-10 Gate B investigation.
const APK_1_3_10 = 'AA07524A453375DE143CA4A506C44657E509CCC0F79981821693903DA5137982';
const LOCAL_KEYSTORE = 'BE2320A5728CFCF1CF9436C04C377BE9BF347807B23183F8C88BE3583A9187A5';

test('publishing with no canonical certificate pinned FAILS CLOSED', () => {
  const r = evaluatePinnedCert('', APK_1_3_10, true);
  assert.equal(r.pass, false, 'an unpinned identity must never pass a publish');
  assert.ok(!r.skipped, 'must be a hard failure, not a skip');
  assert.match(r.detail, /NO CANONICAL CERTIFICATE PINNED/);
});

test('no pin outside publishing is reported as SKIP, never a silent pass', () => {
  const r = evaluatePinnedCert('', APK_1_3_10, false);
  assert.equal(r.skipped, true, 'must be explicitly marked skipped');
  assert.match(r.detail, /SKIPPED/);
});

test('matching certificate passes', () => {
  const r = evaluatePinnedCert(APK_1_3_10, APK_1_3_10, true);
  assert.equal(r.pass, true);
  assert.ok(!r.skipped);
});

test('the 1.3.10 APK is refused once the local keystore key is pinned', () => {
  // The concrete regression: pin a durable key, and the existing 1.3.10 binary
  // (signed by a key nobody can find) must be rejected automatically.
  const r = evaluatePinnedCert(LOCAL_KEYSTORE, APK_1_3_10, true);
  assert.equal(r.pass, false);
  assert.match(r.detail, /MISMATCH/);
  assert.match(r.detail, /Do not publish it/);
});

test('mismatch fails even when not publishing — a pin is always enforced', () => {
  const r = evaluatePinnedCert(LOCAL_KEYSTORE, APK_1_3_10, false);
  assert.equal(r.pass, false, 'a present pin must be enforced regardless of --require-pinned-cert');
});

test('fingerprint comparison ignores colons and case', () => {
  const colonised = 'aa:07:52:4a:45:33:75:de:14:3c:a4:a5:06:c4:46:57:e5:09:cc:c0:f7:99:81:82:16:93:90:3d:a5:13:79:82';
  assert.equal(normalizeFingerprint(colonised), APK_1_3_10);

  const r = evaluatePinnedCert(normalizeFingerprint(colonised), APK_1_3_10, true);
  assert.equal(r.pass, true, 'a colon-separated pin must still match');
});

test('a truncated or malformed pin does not accidentally match', () => {
  // Guards against a substring/prefix comparison creeping in.
  const truncated = APK_1_3_10.slice(0, 32);
  assert.equal(evaluatePinnedCert(truncated, APK_1_3_10, true).pass, false);
});

test('formatFingerprint round-trips through normalizeFingerprint', () => {
  assert.equal(normalizeFingerprint(formatFingerprint(APK_1_3_10)), APK_1_3_10);
});
