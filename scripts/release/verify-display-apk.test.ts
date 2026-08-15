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
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  evaluatePinnedCert,
  normalizeFingerprint,
  formatFingerprint,
  readPackagedOrigins,
  evaluatePackagedOrigins,
  evaluateOriginsBaseline,
  evaluateCandidateBinding,
  evaluateGateABinding,
  computeVerdict,
  exitCodeForVerdict,
  RELEASE_BINDING_CHECKS,
} from './verify-display-apk.mjs';

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

// ─── Compiled default origins (vizora-tv#18) ─────────────────────────────────
//
// Scope: these check BUILD PROVENANCE — which origins were compiled into the
// artifact as its defaults — not where a running device ends up pointed. The
// client layers URL params, stored Preferences and the guarded update_config path
// over DEFAULT_CONFIG at runtime. Do not let these tests be read as covering that.
//
// Within that scope this is the only assertion in the gate that is not blind to
// the compiled origins. An APK built against the wrong environment has a valid
// package id, a correct version, the right certificate and a perfectly good hash —
// so if this check is wrong, nothing else catches it.
//
// These tests therefore include a NEGATIVE artifact-level case: a real zip is
// built on disk with a deliberately mis-pointed origins marker and pushed through
// the same extraction path the publish gate uses. Proving the check passes on a
// good APK would only prove the happy path; a control that has never been seen to
// fire is exactly the kind of unproven coverage that let the original hole exist.

const PINNED_ORIGINS = {
  api: 'https://vizora.cloud',
  realtime: 'wss://vizora.cloud',
  dashboard: 'https://vizora.cloud',
};

/** Build a minimal but REAL zip (stored, no compression) that `unzip` can read. */
function writeStoredZip(zipPath: string, files: Array<{ name: string; body: string }>): void {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const { name, body } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(body, 'utf8');
    // crc32, computed here so we don't pull in a dependency for one field.
    let crc = ~0;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    crc = ~crc >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 10); // stored
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);

    chunks.push(local, nameBuf, data);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  writeFileSync(zipPath, Buffer.concat([...chunks, centralBuf, end]));
}

/**
 * A bundle chunk shaped like the real minified output, carrying the given origins.
 *
 * `quote` reproduces the two forms actually observed: terser emits the marker as a
 * single-quoted literal (so the inner JSON quotes need no escaping), while an
 * unminified build leaves it double-quoted (so they do).
 */
function bundleWith(origins: Record<string, string>, quote: "'" | '"' = "'"): string {
  const json = JSON.stringify(origins);
  const literal = quote === "'" ? `'${json}'` : `"${json.replace(/"/g, '\\"')}"`;
  return `var x=1;globalThis.__VIZORA_RELEASE_ORIGINS__=${literal};console.error("boot");`;
}

function withApk(files: Array<{ name: string; body: string }>, fn: (apk: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'vizora-origins-'));
  const apk = join(dir, 'candidate.apk');
  try {
    writeStoredZip(apk, files);
    fn(apk);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('NEGATIVE: a deliberately mis-pointed APK is REJECTED by the gate', () => {
  const wrong = { api: 'https://api.vizora.io', realtime: 'wss://realtime.vizora.io', dashboard: 'https://dashboard.vizora.io' };
  withApk([{ name: 'assets/public/assets/index-abc.js', body: bundleWith(wrong) }], apk => {
    const read = readPackagedOrigins(apk);
    assert.equal(read.problem, null, 'the mis-pointed marker should still be readable');
    assert.deepEqual(read.origins, wrong);

    const verdict = evaluatePackagedOrigins(PINNED_ORIGINS, read.origins, read.problem, true);
    assert.equal(verdict.pass, false, 'gate MUST reject an APK compiled against the wrong backend');
    assert.match(verdict.detail, /MISMATCH/);
    assert.match(verdict.detail, /api\.vizora\.io/);
  });
});

test('NEGATIVE: one wrong origin out of three is enough to reject', () => {
  const partly = { ...PINNED_ORIGINS, realtime: 'wss://staging.vizora.cloud' };
  withApk([{ name: 'assets/public/assets/index-abc.js', body: bundleWith(partly) }], apk => {
    const read = readPackagedOrigins(apk);
    const verdict = evaluatePackagedOrigins(PINNED_ORIGINS, read.origins, read.problem, true);
    assert.equal(verdict.pass, false);
    assert.match(verdict.detail, /realtime/);
  });
});

test('a correctly pointed APK passes', () => {
  withApk([{ name: 'assets/public/assets/index-abc.js', body: bundleWith(PINNED_ORIGINS) }], apk => {
    const read = readPackagedOrigins(apk);
    assert.deepEqual(read.origins, PINNED_ORIGINS);
    assert.equal(evaluatePackagedOrigins(PINNED_ORIGINS, read.origins, read.problem, true).pass, true);
  });
});

test('an APK with no origins marker FAILS CLOSED rather than passing silently', () => {
  withApk([{ name: 'assets/public/assets/index-abc.js', body: 'var x=1;console.error("no marker here");' }], apk => {
    const read = readPackagedOrigins(apk);
    assert.equal(read.origins, null);
    assert.match(read.problem!, /no __VIZORA_RELEASE_ORIGINS__ marker/);

    const verdict = evaluatePackagedOrigins(PINNED_ORIGINS, read.origins, read.problem, true);
    assert.equal(verdict.pass, false, 'an unreadable endpoint is not an acceptable publish');
  });
});

test('chunks that disagree about the origins are rejected as a mismatched build', () => {
  withApk(
    [
      { name: 'assets/public/assets/index-abc.js', body: bundleWith(PINNED_ORIGINS) },
      { name: 'assets/public/assets/web-def.js', body: bundleWith({ ...PINNED_ORIGINS, api: 'https://api.vizora.io' }) },
    ],
    apk => {
      const read = readPackagedOrigins(apk);
      assert.equal(read.origins, null);
      assert.match(read.problem!, /disagree/);
      assert.equal(evaluatePackagedOrigins(PINNED_ORIGINS, read.origins, read.problem, true).pass, false);
    },
  );
});

test('publishing with no origins pinned FAILS CLOSED', () => {
  const verdict = evaluatePackagedOrigins(null, PINNED_ORIGINS, null, true);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /NO ORIGINS PINNED/);
});

test('no origins pin outside publishing is reported as SKIP, never a silent pass', () => {
  const verdict = evaluatePackagedOrigins(null, PINNED_ORIGINS, null, false);
  assert.equal(verdict.pass, true);
  assert.equal(verdict.skipped, true);
});

test('the marker is read whether terser emitted single or double quotes', () => {
  for (const quote of ["'", '"'] as const) {
    withApk([{ name: 'assets/public/assets/index-abc.js', body: bundleWith(PINNED_ORIGINS, quote) }], apk => {
      assert.deepEqual(readPackagedOrigins(apk).origins, PINNED_ORIGINS, `quote style ${quote} should parse`);
    });
  }
});

// ─── Partial pins and partial markers must fail closed ───────────────────────
//
// The first draft of evaluatePackagedOrigins decided "a pin exists" with .some()
// and then compared only the keys that happened to be present. A releaseOrigins
// block carrying just `api` therefore PASSED on `api` alone while `realtime` and
// `dashboard` dropped silently out of the assertion — a check reporting green
// while covering a third of what it claims. These pin that shut.

test('NEGATIVE: a pin missing realtime is rejected, not silently narrowed', () => {
  const partial = { api: PINNED_ORIGINS.api, dashboard: PINNED_ORIGINS.dashboard };
  const verdict = evaluatePackagedOrigins(partial, PINNED_ORIGINS, null, true);
  assert.equal(verdict.pass, false, 'a partial pin must not pass on the keys it does contain');
  assert.match(verdict.detail, /INCOMPLETE PIN/);
  assert.match(verdict.detail, /realtime/);
});

test('NEGATIVE: a pin missing dashboard is rejected', () => {
  const partial = { api: PINNED_ORIGINS.api, realtime: PINNED_ORIGINS.realtime };
  const verdict = evaluatePackagedOrigins(partial, PINNED_ORIGINS, null, true);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /INCOMPLETE PIN/);
  assert.match(verdict.detail, /dashboard/);
});

test('NEGATIVE: an empty-string pinned value counts as missing', () => {
  const verdict = evaluatePackagedOrigins({ ...PINNED_ORIGINS, realtime: '' }, PINNED_ORIGINS, null, true);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /INCOMPLETE PIN/);
});

test('NEGATIVE: a partial pin fails even outside publishing', () => {
  const partial = { api: PINNED_ORIGINS.api };
  const verdict = evaluatePackagedOrigins(partial, PINNED_ORIGINS, null, false);
  assert.equal(verdict.pass, false, 'malformed pin data is not an absent pin — it never SKIPs');
  assert.notEqual(verdict.skipped, true);
});

test('NEGATIVE: a partial pin whose present key MISMATCHES also fails', () => {
  const partial = { api: 'https://api.vizora.io' };
  const verdict = evaluatePackagedOrigins(partial, PINNED_ORIGINS, null, true);
  assert.equal(verdict.pass, false);
});

test('NEGATIVE: an artifact marker missing one origin is rejected', () => {
  const incomplete = { api: PINNED_ORIGINS.api, realtime: PINNED_ORIGINS.realtime };
  withApk([{ name: 'assets/public/assets/index-abc.js', body: bundleWith(incomplete) }], apk => {
    const read = readPackagedOrigins(apk);
    assert.deepEqual(read.origins, incomplete, 'the truncated marker is still readable');

    const verdict = evaluatePackagedOrigins(PINNED_ORIGINS, read.origins, read.problem, true);
    assert.equal(verdict.pass, false, 'a marker missing dashboard must not pass on the other two');
    assert.match(verdict.detail, /INCOMPLETE MARKER/);
    assert.match(verdict.detail, /dashboard/);
  });
});

test('a complete pin against a complete marker still passes', () => {
  const verdict = evaluatePackagedOrigins(PINNED_ORIGINS, PINNED_ORIGINS, null, true);
  assert.equal(verdict.pass, true);
});

// ─── Release-over-release origins baseline ───────────────────────────────────

// ABSENT may skip; MALFORMED may not. Only a genuinely null baseline has nothing
// to compare against (1.3.13 predates the marker). A non-null baseline missing a
// key is corrupt metadata, and letting it skip would rebuild the same
// "malformed input silently disables the check" hatch just removed from the
// policy pin — one layer down, where it is harder to notice.

test('origins baseline: a null baseline is SKIP, never a silent pass', () => {
  const verdict = evaluateOriginsBaseline(null, PINNED_ORIGINS, null, PINNED_ORIGINS);
  assert.equal(verdict.skipped, true);
  assert.match(verdict.detail, /SKIPPED/);
});

test('NEGATIVE: a baseline missing realtime FAILS — it must not degrade to SKIP', () => {
  const partial = { api: PINNED_ORIGINS.api, dashboard: PINNED_ORIGINS.dashboard };
  const verdict = evaluateOriginsBaseline(partial, PINNED_ORIGINS, null, PINNED_ORIGINS);
  assert.equal(verdict.pass, false);
  assert.notEqual(verdict.skipped, true);
  assert.match(verdict.detail, /INCOMPLETE BASELINE/);
  assert.match(verdict.detail, /realtime/);
});

test('NEGATIVE: a baseline missing dashboard FAILS', () => {
  const partial = { api: PINNED_ORIGINS.api, realtime: PINNED_ORIGINS.realtime };
  const verdict = evaluateOriginsBaseline(partial, PINNED_ORIGINS, null, PINNED_ORIGINS);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /INCOMPLETE BASELINE/);
  assert.match(verdict.detail, /dashboard/);
});

test('NEGATIVE: a baseline with an empty value FAILS', () => {
  const verdict = evaluateOriginsBaseline({ ...PINNED_ORIGINS, api: '' }, PINNED_ORIGINS, null, PINNED_ORIGINS);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /INCOMPLETE BASELINE/);
});

test('NEGATIVE: an empty-object baseline FAILS rather than skipping', () => {
  const verdict = evaluateOriginsBaseline({}, PINNED_ORIGINS, null, PINNED_ORIGINS);
  assert.equal(verdict.pass, false);
  assert.notEqual(verdict.skipped, true);
});

test('origins baseline: unchanged origins pass', () => {
  assert.equal(evaluateOriginsBaseline(PINNED_ORIGINS, PINNED_ORIGINS, null, PINNED_ORIGINS).pass, true);
});

// ─── Authorised environment migration ────────────────────────────────────────
//
// published.compiledOrigins describes what customers are running RIGHT NOW, so a
// deliberate move is authorised out of band instead of by rewriting that record
// to clear the gate.

const MOVED = { api: 'https://api.vizora.io', realtime: 'wss://realtime.vizora.io', dashboard: 'https://dashboard.vizora.io' };
const GOOD_TRANSITION = { from: PINNED_ORIGINS, to: MOVED, approvedBy: 'Srini', approvedAt: '2026-08-13' };

test('NEGATIVE: an unauthorised environment move is rejected', () => {
  const verdict = evaluateOriginsBaseline(PINNED_ORIGINS, MOVED, null, MOVED);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /UNAUTHORISED ORIGIN CHANGE/);
  assert.match(verdict.detail, /Do NOT edit published\.compiledOrigins/);
});

test('an APPROVED transition permits the move', () => {
  const verdict = evaluateOriginsBaseline(PINNED_ORIGINS, MOVED, GOOD_TRANSITION, MOVED);
  assert.equal(verdict.pass, true);
  assert.match(verdict.detail, /authorised migration by Srini/);
});

test('NEGATIVE: a stale transition (from != live baseline) is rejected', () => {
  // The migration already happened; the same block must not wave through another.
  const stale = { ...GOOD_TRANSITION, from: { api: 'https://old.example.com', realtime: 'wss://old.example.com', dashboard: 'https://old.example.com' } };
  const verdict = evaluateOriginsBaseline(PINNED_ORIGINS, MOVED, stale, MOVED);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /does not match the live published baseline/);
});

test('NEGATIVE: a transition whose `to` differs from the actual artifact is rejected', () => {
  const elsewhere = { ...MOVED, api: 'https://sneaky.example.com' };
  const verdict = evaluateOriginsBaseline(PINNED_ORIGINS, elsewhere, GOOD_TRANSITION, MOVED);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /does not match what this APK was actually compiled with/);
});

test('NEGATIVE: a transition that disagrees with the policy pin is rejected', () => {
  const verdict = evaluateOriginsBaseline(PINNED_ORIGINS, MOVED, GOOD_TRANSITION, PINNED_ORIGINS);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /does not match the releaseOrigins policy pin/);
});

test('NEGATIVE: an unapproved transition (no approver) is rejected', () => {
  const verdict = evaluateOriginsBaseline(PINNED_ORIGINS, MOVED, { ...GOOD_TRANSITION, approvedBy: '' }, MOVED);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /approvedBy is empty/);
});

test('NEGATIVE: a transition with incomplete from/to is rejected', () => {
  const verdict = evaluateOriginsBaseline(PINNED_ORIGINS, MOVED, { ...GOOD_TRANSITION, to: { api: MOVED.api } }, MOVED);
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /does not name all three origins/);
});

// ─── Candidate ↔ artifact binding, and Gate A's exact-hash binding ───────────
//
// `candidate` is promoted to `published` after a successful publish and becomes
// the baseline the NEXT release is compared against. Nothing used to check it
// described the bytes being published — the hand-off was a note telling a human
// to copy fields across. A wrong candidate poisons the next baseline; a null
// field silently SKIPs the check built on it, which reads as coverage.

const APK_SHA = 'C5C0B72C4B3EB15FA08F63F9001FB3CD6CB0361957E601F682179BE50F856C72';
const OTHER_SHA = '1D035BDBB48720B9BCE1F0C8ADA8E74436E9D37A03D9A11FF7CEFA6B515F8EF7';

const ARTIFACT = {
  package: 'com.vizora.display',
  versionName: '1.3.14',
  versionCode: 10144,
  apkSha256: APK_SHA,
  apkBytes: 1250365,
  signingCertSha256: LOCAL_KEYSTORE,
  compiledOrigins: PINNED_ORIGINS,
};

const GOOD_CANDIDATE = {
  package: 'com.vizora.display',
  versionName: '1.3.14',
  versionCode: 10144,
  apkSha256: APK_SHA,
  apkBytes: 1250365,
  signingCertSha256: LOCAL_KEYSTORE,
  compiledOrigins: PINNED_ORIGINS,
};

test('a candidate that describes the APK passes', () => {
  assert.equal(evaluateCandidateBinding(GOOD_CANDIDATE, ARTIFACT, true).pass, true);
});

test('NEGATIVE: publishing with no candidate block FAILS CLOSED', () => {
  const v = evaluateCandidateBinding(null, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /NO CANDIDATE RECORDED/);
});

test('NEGATIVE: a STALE candidate hash is rejected', () => {
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, apkSha256: OTHER_SHA }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /candidate\.apkSha256/);
});

test('NEGATIVE: a candidate describing a different version is rejected', () => {
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, versionCode: 10143 }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /candidate\.versionCode/);
});

test('NEGATIVE: a candidate with the wrong signing certificate is rejected', () => {
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, signingCertSha256: APK_1_3_10 }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /candidate\.signingCertSha256/);
});

test('NEGATIVE: candidate.compiledOrigins null while the APK HAS a marker is rejected', () => {
  // The exact sequence flagged in review: origins verify fine against the policy
  // pin, but the record carries null, so promoting it permanently SKIPs the next
  // release's baseline check.
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, compiledOrigins: null }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /null but this APK carries an origins marker/);
});

test('NEGATIVE: candidate.compiledOrigins that disagree with the APK are rejected', () => {
  const wrong = { ...PINNED_ORIGINS, api: 'https://api.vizora.io' };
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, compiledOrigins: wrong }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /disagrees with the APK/);
});

test('NEGATIVE: partial candidate.compiledOrigins are rejected', () => {
  const partial = { api: PINNED_ORIGINS.api, realtime: PINNED_ORIGINS.realtime };
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, compiledOrigins: partial }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /incomplete/);
});

test('NEGATIVE: candidate records origins but the APK has no marker — rejected', () => {
  const preMarkerApk = { ...ARTIFACT, compiledOrigins: null };
  const v = evaluateCandidateBinding(GOOD_CANDIDATE, preMarkerApk, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /no marker to corroborate/);
});

test('a pre-marker artifact with a null candidate origins field is consistent', () => {
  const preMarkerApk = { ...ARTIFACT, compiledOrigins: null };
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, compiledOrigins: null }, preMarkerApk, true);
  assert.equal(v.pass, true);
});

test('NEGATIVE: an absent candidate.compiledOrigins field is rejected', () => {
  const { compiledOrigins, ...noField } = GOOD_CANDIDATE;
  const v = evaluateCandidateBinding(noField, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /is absent/);
});

test('Gate A: an approval bound to this APK passes', () => {
  const v = evaluateGateABinding(
    { artifactApprovedSha256: APK_SHA, artifactApprovedBy: 'Srini' }, APK_SHA, APK_SHA, true);
  assert.equal(v.pass, true);
});

test('NEGATIVE: publishing with no approved hash FAILS CLOSED', () => {
  const v = evaluateGateABinding({ artifactApprovedBy: 'Srini' }, APK_SHA, APK_SHA, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /NO APPROVED HASH RECORDED/);
});

test('NEGATIVE: a STALE Gate A hash (approval for a previous build) is rejected', () => {
  const v = evaluateGateABinding(
    { artifactApprovedSha256: OTHER_SHA, artifactApprovedBy: 'Srini' }, OTHER_SHA, APK_SHA, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /GATE A MISMATCH/);
  assert.match(v.detail, /rebuild produces different bytes/);
});

test('NEGATIVE: approval and candidate disagreeing about the artifact is rejected', () => {
  const v = evaluateGateABinding(
    { artifactApprovedSha256: APK_SHA, artifactApprovedBy: 'Srini' }, OTHER_SHA, APK_SHA, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /does not match candidate\.apkSha256/);
});

test('NEGATIVE: an approved hash with no named approver is rejected', () => {
  const v = evaluateGateABinding(
    { artifactApprovedSha256: APK_SHA, artifactApprovedBy: '' }, APK_SHA, APK_SHA, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /artifactApprovedBy is empty/);
});

test('Gate A hash comparison ignores colons and case', () => {
  const v = evaluateGateABinding(
    { artifactApprovedSha256: formatFingerprint(APK_SHA).toLowerCase(), artifactApprovedBy: 'Srini' },
    APK_SHA, APK_SHA, true);
  assert.equal(v.pass, true);
});

// apkBytes had the last surviving instance of "malformed data narrows the check":
// the comparison was gated on Number.isInteger(...), so a missing, null or
// string-valued size skipped it entirely and the candidate still passed. It must
// be a positive integer AND match, with every other shape failing closed.

test('NEGATIVE: a MISSING candidate.apkBytes is rejected, not skipped', () => {
  const { apkBytes, ...noSize } = GOOD_CANDIDATE;
  const v = evaluateCandidateBinding(noSize, ARTIFACT, true);
  assert.equal(v.pass, false, 'an absent size must not pass as though it had been compared');
  assert.match(v.detail, /apkBytes must be a positive integer/);
});

test('NEGATIVE: a null candidate.apkBytes is rejected', () => {
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, apkBytes: null }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /apkBytes must be a positive integer/);
});

test('NEGATIVE: a STRING candidate.apkBytes is rejected even when it looks right', () => {
  // "1250365" would compare equal under a loose ==; it must still fail on type.
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, apkBytes: '1250365' }, ARTIFACT, true);
  assert.equal(v.pass, false, 'a string size must not satisfy a numeric field');
  assert.match(v.detail, /apkBytes must be a positive integer/);
});

test('NEGATIVE: a WRONG integer candidate.apkBytes is rejected', () => {
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, apkBytes: 999 }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /candidate\.apkBytes is 999 but the APK is 1250365 bytes/);
});

test('NEGATIVE: a non-integer numeric candidate.apkBytes is rejected', () => {
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, apkBytes: 1250365.5 }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /apkBytes must be a positive integer/);
});

test('NEGATIVE: a zero or negative candidate.apkBytes is rejected', () => {
  for (const bad of [0, -1250365]) {
    const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, apkBytes: bad }, ARTIFACT, true);
    assert.equal(v.pass, false, `apkBytes ${bad} must fail`);
    assert.match(v.detail, /apkBytes must be a positive integer/);
  }
});

// versionCode is the delay-fuse case: a string that passes the candidate binder is
// promoted into published.versionCode, where the downgrade check requires an
// integer — so a "harmless" type error switches off a safety check one release
// later. Strict on both sides.

test('NEGATIVE: a STRING candidate.versionCode is rejected even when the value is right', () => {
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, versionCode: '10144' }, ARTIFACT, true);
  assert.equal(v.pass, false, '"10144" must not satisfy an integer versionCode');
  assert.match(v.detail, /versionCode must be a positive integer/);
  assert.match(v.detail, /disables the Android downgrade check/);
});

test('NEGATIVE: a missing candidate.versionCode is rejected', () => {
  const { versionCode, ...noVc } = GOOD_CANDIDATE;
  const v = evaluateCandidateBinding(noVc, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /versionCode must be a positive integer/);
});

test('NEGATIVE: a null candidate.versionCode is rejected', () => {
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, versionCode: null }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /versionCode must be a positive integer/);
});

test('NEGATIVE: fractional / zero / negative candidate.versionCode are rejected', () => {
  for (const bad of [10144.5, 0, -10144]) {
    const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, versionCode: bad }, ARTIFACT, true);
    assert.equal(v.pass, false, `versionCode ${bad} must fail`);
    assert.match(v.detail, /versionCode must be a positive integer/);
  }
});

test('NEGATIVE: a wrong integer candidate.versionCode still fails on value', () => {
  const v = evaluateCandidateBinding({ ...GOOD_CANDIDATE, versionCode: 10143 }, ARTIFACT, true);
  assert.equal(v.pass, false);
  assert.match(v.detail, /candidate\.versionCode is 10143 but the APK has 10144/);
});

test('a correct integer candidate.versionCode passes', () => {
  assert.equal(evaluateCandidateBinding(GOOD_CANDIDATE, ARTIFACT, true).pass, true);
});

// ─── Vizora#318 — a run that skipped its bindings must not print "PASS" ──────────
//
// The defect: every release-binding check SKIPS when its flag/record is absent, and a
// skip carries `pass: true`, so `checks.every(c => c.pass)` was true and the weakest
// possible invocation printed the same VERDICT as a fully bound one. The difference
// was visible only in SKIP lines above the verdict — exactly where a hurried reader
// does not look.
//
// "No binding check ran" and "every binding check passed" are completely different
// statements about an artifact. They must not share a word.

const pass = (name: string) => ({ name, pass: true, detail: '' });
const fail = (name: string) => ({ name, pass: false, detail: '' });
const skip = (name: string) => ({ name, pass: true, skipped: true, detail: '' });

const BINDING = RELEASE_BINDING_CHECKS;

test('computeVerdict: fully bound run with nothing wrong is PASS', () => {
  const checks = [pass('package id'), ...BINDING.map(pass)];
  assert.equal(computeVerdict(checks), 'PASS');
  assert.equal(exitCodeForVerdict('PASS'), 0);
});

test('computeVerdict: a skipped RELEASE-BINDING check downgrades PASS to PASS_WITH_SKIPS', () => {
  for (const bindingName of BINDING) {
    const checks = [
      pass('package id'),
      ...BINDING.map(n => (n === bindingName ? skip(n) : pass(n))),
    ];
    assert.equal(
      computeVerdict(checks),
      'PASS_WITH_SKIPS',
      `skipping "${bindingName}" must not read as a full pass`,
    );
  }
  assert.equal(exitCodeForVerdict('PASS_WITH_SKIPS'), 3);
});

test('computeVerdict: the DEFAULT invocation shape (all four skipped) is PASS_WITH_SKIPS', () => {
  // This is precisely what `--apk <path>` with no other flags produces, and precisely
  // what used to print VERDICT: PASS.
  const checks = [pass('package id'), pass('apksigner verifies the APK'), ...BINDING.map(skip)];
  assert.equal(computeVerdict(checks), 'PASS_WITH_SKIPS');
});

test('computeVerdict: a skipped NON-binding check is still a full PASS', () => {
  // Legitimate skips exist — e.g. the release-over-release origins baseline on a first
  // publish. Those must not be conflated with an unbound artifact, or the new verdict
  // becomes noise and gets ignored.
  const checks = [
    pass('package id'),
    skip('compiled default origins match the previously published release'),
    ...BINDING.map(pass),
  ];
  assert.equal(computeVerdict(checks), 'PASS');
});

test('computeVerdict: FAIL outranks a binding skip', () => {
  const checks = [fail('package id'), ...BINDING.map(skip)];
  assert.equal(computeVerdict(checks), 'FAIL');
  assert.equal(exitCodeForVerdict('FAIL'), 1);
});

test('computeVerdict: exit codes are distinct, so callers can tell the three apart', () => {
  const codes = ['PASS', 'FAIL', 'PASS_WITH_SKIPS'].map(exitCodeForVerdict);
  assert.equal(new Set(codes).size, 3, 'each verdict needs its own exit code');
  assert.equal(exitCodeForVerdict('PASS'), 0, 'only a fully bound run may exit 0');
  assert.notEqual(exitCodeForVerdict('PASS_WITH_SKIPS'), 0, 'an unbound run must not exit 0');
});

test('RELEASE_BINDING_CHECKS names the four checks that tie artifact to record', () => {
  // Pinned by name because these strings are the join between the check sites and the
  // verdict rule. Rename a check without updating this list and the verdict silently
  // stops noticing that it was skipped — the original bug, reintroduced quietly.
  assert.deepEqual([...BINDING].sort(), [
    'Gate A approval is bound to this exact APK',
    'candidate record matches this exact APK',
    'certificate matches the pinned canonical signing identity',
    'compiled default origins match the pinned expectation',
  ]);
});
