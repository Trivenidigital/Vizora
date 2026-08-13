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

// ─── Compiled backend origins (vizora-tv#18) ─────────────────────────────────
//
// The endpoint check is the only assertion in the gate that is not blind to what
// the binary talks to. An APK aimed at the wrong environment has a valid package
// id, a correct version, the right certificate and a perfectly good hash — so if
// this check is wrong, nothing else catches it.
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
  for (const quote of ["'", '"']) {
    withApk([{ name: 'assets/public/assets/index-abc.js', body: bundleWith(PINNED_ORIGINS, quote) }], apk => {
      assert.deepEqual(readPackagedOrigins(apk).origins, PINNED_ORIGINS, `quote style ${quote} should parse`);
    });
  }
});
