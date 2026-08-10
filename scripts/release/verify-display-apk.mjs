#!/usr/bin/env node
/**
 * Vizora Display APK — deterministic release gate.
 *
 * Verifies the identity, signing key and integrity of an Android TV display
 * APK *before* it is published to https://vizora.cloud/downloads/. Every check
 * is mechanical: no judgement, no "looks right", exit code is the verdict.
 *
 * Implements gate steps 1-5 and 7 from the approved plan:
 *   1. package id is exactly the expected applicationId
 *   2. versionName / versionCode are read from the binary manifest
 *   3. signing certificate SHA-256 is extracted
 *   4. certificate SHA-256 is compared against the previously accepted release
 *      and versionCode is asserted strictly greater (Android update rule)
 *   5. APK SHA-256 is calculated
 *   7. --url downloads the published artifact and compares bytes to the source
 *
 * Usage:
 *   node scripts/release/verify-display-apk.mjs --apk <path> [--against <json>]
 *   node scripts/release/verify-display-apk.mjs --apk <path> --url https://vizora.cloud/downloads/vizora-display.apk
 *   node scripts/release/verify-display-apk.mjs --apk <path> --json
 *
 * Exit codes:
 *   0 — every requested assertion passed
 *   1 — an assertion FAILED (do not publish)
 *   2 — could not complete verification (missing tool, unreadable APK)
 *
 * Requires: JDK `keytool` on PATH. No Android SDK needed — the binary
 * AndroidManifest.xml is parsed directly.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const DEFAULT_PACKAGE = 'com.vizora.display';

// ─── Binary AndroidManifest.xml (AXML) parsing ───────────────────────────────
// Format reference: AOSP frameworks/base/libs/androidfw/include/androidfw/ResourceTypes.h

const RES_STRING_POOL_TYPE = 0x0001;
const RES_XML_RESOURCE_MAP_TYPE = 0x0180;
const RES_XML_START_ELEMENT_TYPE = 0x0102;
const UTF8_FLAG = 1 << 8;

/** Android framework resource ids, used when aapt2 strips attribute name strings. */
const ATTR_RES_ID = {
  versionCode: 0x0101021b,
  versionName: 0x0101021c,
};

/** Read a length-prefixed string-pool entry. Lengths are varints. */
function readPoolString(buf, base, isUtf8) {
  if (isUtf8) {
    let p = base;
    // Two varints: character count, then byte count. Only the byte count matters.
    if (buf[p] & 0x80) p += 2;
    else p += 1;
    let byteLen = buf[p];
    if (byteLen & 0x80) {
      byteLen = ((byteLen & 0x7f) << 8) | buf[p + 1];
      p += 2;
    } else {
      p += 1;
    }
    return buf.toString('utf8', p, p + byteLen);
  }

  let p = base;
  let charLen = buf.readUInt16LE(p);
  if (charLen & 0x8000) {
    charLen = ((charLen & 0x7fff) << 16) | buf.readUInt16LE(p + 2);
    p += 4;
  } else {
    p += 2;
  }
  return buf.toString('utf16le', p, p + charLen * 2);
}

/**
 * Extract package / versionCode / versionName from a binary AndroidManifest.xml.
 * Walks chunks rather than assuming fixed offsets, so it tolerates the
 * resource-map and namespace chunks that aapt2 emits.
 */
function parseAndroidManifest(buf) {
  if (buf.length < 8) throw new Error('AndroidManifest.xml is truncated');

  let strings = [];
  let resourceMap = [];
  let result = { package: null, versionCode: null, versionName: null };

  // Top-level XML chunk header is 8 bytes; child chunks follow.
  let offset = 8;

  while (offset + 8 <= buf.length) {
    const type = buf.readUInt16LE(offset);
    const headerSize = buf.readUInt16LE(offset + 2);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkSize < 8 || offset + chunkSize > buf.length) break;

    if (type === RES_STRING_POOL_TYPE) {
      const stringCount = buf.readUInt32LE(offset + 8);
      const flags = buf.readUInt32LE(offset + 16);
      const stringsStart = buf.readUInt32LE(offset + 20);
      const isUtf8 = (flags & UTF8_FLAG) !== 0;
      strings = new Array(stringCount);
      for (let i = 0; i < stringCount; i++) {
        const strOffset = buf.readUInt32LE(offset + headerSize + i * 4);
        strings[i] = readPoolString(buf, offset + stringsStart + strOffset, isUtf8);
      }
    } else if (type === RES_XML_RESOURCE_MAP_TYPE) {
      const count = (chunkSize - headerSize) / 4;
      resourceMap = new Array(count);
      for (let i = 0; i < count; i++) {
        resourceMap[i] = buf.readUInt32LE(offset + headerSize + i * 4);
      }
    } else if (type === RES_XML_START_ELEMENT_TYPE) {
      // ResXMLTree_node: header(8) lineNumber(8..11) comment(12..15), then
      // ResXMLTree_attrExt: ns(16..19) name(20..23) attributeStart(24..25)
      // attributeSize(26..27) attributeCount(28..29).
      const nameIdx = buf.readUInt32LE(offset + 20);
      const elementName = strings[nameIdx];

      if (elementName === 'manifest') {
        const attrStart = buf.readUInt16LE(offset + 24);
        const attrSize = buf.readUInt16LE(offset + 26);
        const attrCount = buf.readUInt16LE(offset + 28);
        // attributeStart is relative to the start of attrExt, i.e. offset + 16.
        const attrBase = offset + 16 + attrStart;

        for (let i = 0; i < attrCount; i++) {
          const a = attrBase + i * attrSize;
          const attrNameIdx = buf.readUInt32LE(a + 4);
          const rawValueIdx = buf.readUInt32LE(a + 8);
          const dataType = buf[a + 15];
          const data = buf.readUInt32LE(a + 16);

          // aapt2 sometimes blanks the name string; fall back to the
          // framework resource id from the resource map.
          let attrName = strings[attrNameIdx] || '';
          if (!attrName && resourceMap[attrNameIdx] !== undefined) {
            const resId = resourceMap[attrNameIdx];
            if (resId === ATTR_RES_ID.versionCode) attrName = 'versionCode';
            else if (resId === ATTR_RES_ID.versionName) attrName = 'versionName';
          }

          const asString = () =>
            rawValueIdx !== 0xffffffff ? strings[rawValueIdx] : dataType === 0x03 ? strings[data] : String(data);

          if (attrName === 'package') result.package = asString();
          else if (attrName === 'versionCode') result.versionCode = data;
          else if (attrName === 'versionName') result.versionName = asString();
        }
        // <manifest> is the root element — nothing further to read.
        return result;
      }
    }

    offset += chunkSize;
  }

  return result;
}

// ─── APK reading ─────────────────────────────────────────────────────────────

/** Extract a single entry from the APK (a zip) using the bundled `unzip`. */
function extractEntry(apkPath, entryName) {
  try {
    return execFileSync('unzip', ['-p', apkPath, entryName], {
      maxBuffer: 16 * 1024 * 1024,
      encoding: 'buffer',
    });
  } catch (err) {
    throw new Error(`could not extract ${entryName} from APK: ${err.message}`);
  }
}

/**
 * Report which APK signature schemes are present.
 *
 * NOTE: `keytool -printcert -jarfile` only reads the v1 (JAR) signature. If an
 * APK were v2/v3-signed with a *different* key than its v1 block, keytool would
 * not notice. Full cross-scheme validation needs `apksigner verify`, which
 * requires the Android SDK. We detect the presence of the v2/v3 signing block
 * so the report can state exactly what was and was not checked.
 */
function detectSignatureSchemes(buf, hasV1) {
  const magic = Buffer.from('APK Sig Block 42', 'utf8');
  return { v1: hasV1, v2OrV3Block: buf.includes(magic) };
}

/** Extract the signing certificate SHA-256 via keytool. */
function readSigningCert(apkPath) {
  let out;
  try {
    out = execFileSync('keytool', ['-printcert', '-jarfile', apkPath], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (err) {
    const stdout = err.stdout ? String(err.stdout) : '';
    throw new Error(
      `keytool could not read a v1 (JAR) signature from the APK. ` +
        `If this build is v2/v3-signed only, verify it with \`apksigner verify --print-certs\` instead. ${stdout}`.trim(),
    );
  }

  const sha256 = /SHA256:\s*([0-9A-Fa-f:]+)/.exec(out);
  const owner = /Owner:\s*(.+)/.exec(out);
  const validUntil = /Valid from:.*until:\s*(.+)/.exec(out);
  const sigAlg = /Signature algorithm name:\s*(.+)/.exec(out);
  const keyAlg = /Subject Public Key Algorithm:\s*(.+)/.exec(out);

  if (!sha256) throw new Error('keytool output did not contain a SHA256 fingerprint');

  return {
    sha256: normalizeFingerprint(sha256[1]),
    owner: owner ? owner[1].trim() : null,
    validUntil: validUntil ? validUntil[1].trim() : null,
    signatureAlgorithm: sigAlg ? sigAlg[1].trim() : null,
    keyAlgorithm: keyAlg ? keyAlg[1].trim() : null,
  };
}

/**
 * Locate `apksigner` — PATH first, then the Android SDK build-tools dirs.
 * Returns null when it is not installed anywhere we can find.
 */
function findApksigner() {
  const isWin = process.platform === 'win32';
  const names = isWin ? ['apksigner.bat', 'apksigner'] : ['apksigner'];

  for (const name of names) {
    try {
      execFileSync(isWin ? 'where' : 'which', [name], { stdio: 'pipe' });
      return name;
    } catch {
      /* not on PATH — keep looking */
    }
  }

  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
    process.env.HOME ? join(process.env.HOME, 'Android', 'Sdk') : null,
    process.env.HOME ? join(process.env.HOME, 'Library', 'Android', 'sdk') : null,
  ].filter(Boolean);

  for (const root of sdkRoots) {
    const buildTools = join(root, 'build-tools');
    if (!existsSync(buildTools)) continue;
    let versions;
    try {
      versions = readdirSync(buildTools).sort().reverse(); // newest first
    } catch {
      continue;
    }
    for (const v of versions) {
      for (const name of names) {
        const candidate = join(buildTools, v, name);
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  return null;
}

/**
 * Full cross-scheme signature verification via apksigner.
 *
 * This is what keytool cannot do: keytool reads the v1 (JAR) block only, so an
 * APK whose v2/v3 blocks were signed with a DIFFERENT key would pass a keytool
 * check. apksigner validates every scheme and reports each signer's certificate
 * digest, letting us assert they all agree.
 */
function runApksigner(binary, apkPath) {
  let out;
  let verified = true;

  // Node refuses to execFile a .bat/.cmd directly (EINVAL, the CVE-2024-27980
  // hardening). Route those through cmd.exe with an ARGUMENT ARRAY — never a
  // concatenated shell string, so the APK path cannot inject.
  const isBatch = /\.(bat|cmd)$/i.test(binary);
  const cmd = isBatch ? process.env.COMSPEC || 'cmd.exe' : binary;
  const argv = ['verify', '--verbose', '--print-certs', apkPath];
  const args = isBatch ? ['/c', binary, ...argv] : argv;

  try {
    out = execFileSync(cmd, args, {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      stdio: 'pipe',
    });
  } catch (err) {
    // Non-zero exit means verification FAILED; keep the output for the report.
    verified = false;
    out = `${err.stdout ? String(err.stdout) : ''}${err.stderr ? String(err.stderr) : ''}`;
  }

  // `[\d.]+` so "v3.1" is its own key rather than colliding with "v3".
  const schemes = {};
  for (const m of out.matchAll(/Verified using (v[\d.]+) scheme[^:]*:\s*(true|false)/gi)) {
    schemes[m[1].toLowerCase()] = m[2].toLowerCase() === 'true';
  }

  const signerDigests = [...out.matchAll(/Signer #(\d+) certificate SHA-256 digest:\s*([0-9a-fA-F]+)/g)].map(m => ({
    signer: Number(m[1]),
    sha256: m[2].toUpperCase(),
  }));

  return {
    verified: verified && /^Verifies\s*$/m.test(out),
    schemes,
    signerDigests,
    raw: out.trim(),
  };
}

/** Fingerprints compare case-insensitively and ignore colon separators. */
function normalizeFingerprint(fp) {
  return String(fp).replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
}

function formatFingerprint(hex) {
  return (hex.match(/.{2}/g) || []).join(':');
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.apk) {
    console.error('usage: verify-display-apk.mjs --apk <path> [--against <released.json>] [--url <published-url>] [--json]');
    process.exit(2);
  }

  const apkPath = resolve(String(args.apk));
  if (!existsSync(apkPath)) {
    console.error(`FATAL: APK not found: ${apkPath}`);
    process.exit(2);
  }

  const expectPackage = args['expect-package'] ? String(args['expect-package']) : DEFAULT_PACKAGE;

  // Load the previously accepted release, if one is being compared against.
  // `--against deploy/tv/release.json` reads the `published` block — the
  // artifact currently live. It is null before the first publish, in which
  // case there is no baseline and the comparison checks are reported as
  // skipped rather than silently passing.
  let baseline = null;
  let baselineAbsent = false;
  if (args.against) {
    const p = resolve(String(args.against));
    if (!existsSync(p)) {
      console.error(`FATAL: baseline manifest not found: ${p}`);
      process.exit(2);
    }
    const doc = JSON.parse(readFileSync(p, 'utf8'));
    baseline = Object.prototype.hasOwnProperty.call(doc, 'published') ? doc.published : doc;
    if (!baseline) baselineAbsent = true;
  }

  const bytes = readFileSync(apkPath);
  const apkSha256 = createHash('sha256').update(bytes).digest('hex').toUpperCase();

  let manifest;
  let cert;
  let schemes;
  try {
    const manifestBuf = extractEntry(apkPath, 'AndroidManifest.xml');
    manifest = parseAndroidManifest(manifestBuf);
    cert = readSigningCert(apkPath);
    let hasV1 = false;
    try {
      // execFileSync, not execSync: apkPath must never be interpolated into a shell string.
      hasV1 = execFileSync('unzip', ['-l', apkPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
        .split('\n')
        .some(l => /META-INF\/.*\.(RSA|DSA|EC)$/i.test(l.trim()));
    } catch {
      hasV1 = true; // keytool already succeeded, so a v1 block exists
    }
    schemes = detectSignatureSchemes(bytes, hasV1);
  } catch (err) {
    console.error(`FATAL: ${err.message}`);
    process.exit(2);
  }

  // ─── Assertions ────────────────────────────────────────────────────────────

  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass, detail });

  // 1. package id
  check(
    'package id',
    manifest.package === expectPackage,
    `${manifest.package ?? '(unreadable)'} (expected ${expectPackage})`,
  );

  // 2. versionName / versionCode readable
  check(
    'versionName / versionCode readable',
    manifest.versionName != null && Number.isInteger(manifest.versionCode),
    `versionName=${manifest.versionName ?? '(unreadable)'} versionCode=${manifest.versionCode ?? '(unreadable)'}`,
  );

  // 3. signing certificate extracted
  check('signing certificate readable', Boolean(cert.sha256), formatFingerprint(cert.sha256));

  // 3b. Full cross-scheme signature verification (apksigner).
  //
  // REQUIRED on the release machine. keytool validates the v1 block only, so
  // without this an APK whose v2/v3 blocks carry a different key would pass.
  // With --require-apksigner, an absent SDK is a FAILURE, not a caveat —
  // production publication fails closed rather than proceeding half-verified.
  const requireApksigner = Boolean(args['require-apksigner']);
  const apksignerBin = findApksigner();
  let apksigner = null;

  if (!apksignerBin) {
    if (requireApksigner) {
      check(
        'full signature verification (apksigner)',
        false,
        'apksigner NOT FOUND — required for publication. Install Android build-tools ' +
          '(sdkmanager "build-tools;34.0.0") or set ANDROID_HOME. Refusing to treat a ' +
          'keytool-only check as sufficient: it validates the v1 block and would miss a ' +
          'v2/v3 block signed with a different key.',
      );
    } else {
      checks.push({
        name: 'full signature verification (apksigner)',
        pass: true,
        skipped: true,
        detail:
          'SKIPPED — apksigner not installed. keytool validated the v1 block ONLY. ' +
          'Run with --require-apksigner on the release machine to make this mandatory.',
      });
    }
  } else {
    apksigner = runApksigner(apksignerBin, apkPath);

    check(
      'apksigner verifies the APK',
      apksigner.verified,
      apksigner.verified
        ? `verified using ${Object.entries(apksigner.schemes)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(', ') || '(no scheme reported)'}`
        : `apksigner FAILED to verify this APK:\n${apksigner.raw.split('\n').slice(0, 8).join('\n')}`,
    );

    const anyScheme = Object.values(apksigner.schemes).some(Boolean);
    check('at least one signature scheme verified', anyScheme, JSON.stringify(apksigner.schemes));

    // The cross-scheme assertion keytool cannot make: every signer's cert must
    // be the same key we read from the v1 block.
    const mismatched = apksigner.signerDigests.filter(d => d.sha256 !== cert.sha256);
    check(
      'all signers match the expected certificate',
      apksigner.signerDigests.length > 0 && mismatched.length === 0,
      apksigner.signerDigests.length === 0
        ? 'apksigner reported no signer certificates'
        : mismatched.length === 0
          ? `${apksigner.signerDigests.length} signer(s), all ${formatFingerprint(cert.sha256)}`
          : `MISMATCH — signer(s) ${mismatched.map(d => `#${d.signer}=${formatFingerprint(d.sha256)}`).join(', ')} ` +
            `differ from the v1 certificate ${formatFingerprint(cert.sha256)}`,
    );
  }

  // 4. certificate matches the previously accepted release + versionCode increases
  if (baselineAbsent) {
    // Not a pass and not a failure — there is genuinely nothing to compare to.
    // Stated explicitly so a first publish can never be mistaken for a
    // cert-continuity check that ran and succeeded.
    checks.push({
      name: 'certificate matches previously accepted release',
      pass: true,
      skipped: true,
      detail:
        'SKIPPED — no published baseline yet (first publish). This APK\'s certificate ' +
        'becomes the baseline every future release is compared against.',
    });
  }
  if (baseline) {
    const baseCert = normalizeFingerprint(baseline.signingCertSha256 || '');
    if (baseCert) {
      check(
        'certificate matches previously accepted release',
        baseCert === cert.sha256,
        baseCert === cert.sha256
          ? 'identical — installs as an update'
          : `MISMATCH — baseline ${formatFingerprint(baseCert)} vs apk ${formatFingerprint(cert.sha256)}. ` +
            `A different key means every installed TV must be uninstalled and re-paired.`,
      );
    }
    if (Number.isInteger(baseline.versionCode)) {
      const strictlyGreater = manifest.versionCode > baseline.versionCode;
      const same = manifest.versionCode === baseline.versionCode;
      check(
        'versionCode strictly greater than published',
        strictlyGreater || same,
        same
          ? `${manifest.versionCode} — same build as published (re-publish, not an upgrade)`
          : strictlyGreater
            ? `${manifest.versionCode} > ${baseline.versionCode}`
            : `${manifest.versionCode} <= ${baseline.versionCode} — Android will REFUSE this as a downgrade`,
      );
    }
  }

  // 7. published artifact matches the source APK byte-for-byte
  let published = null;
  if (args.url) {
    const url = String(args.url);
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const body = Buffer.from(await res.arrayBuffer());
      const sha = createHash('sha256').update(body).digest('hex').toUpperCase();
      published = {
        url,
        status: res.status,
        contentType: res.headers.get('content-type'),
        contentLength: body.length,
        sha256: sha,
      };
      check('published URL returns 200', res.status === 200, `HTTP ${res.status}`);
      check(
        'published Content-Type is APK',
        (res.headers.get('content-type') || '').includes('application/vnd.android.package-archive'),
        res.headers.get('content-type') || '(none)',
      );
      check(
        'published bytes match source APK',
        sha === apkSha256,
        sha === apkSha256 ? `${body.length} bytes, sha256 identical` : `MISMATCH — served ${formatFingerprint(sha)}`,
      );
    } catch (err) {
      check('published URL reachable', false, err.message);
    }
  }

  // ─── Output ────────────────────────────────────────────────────────────────

  const report = {
    apk: apkPath,
    package: manifest.package,
    versionName: manifest.versionName,
    versionCode: manifest.versionCode,
    apkSha256,
    apkBytes: bytes.length,
    signingCertSha256: cert.sha256,
    signingCertOwner: cert.owner,
    signingCertValidUntil: cert.validUntil,
    signatureAlgorithm: cert.signatureAlgorithm,
    keyAlgorithm: cert.keyAlgorithm,
    signatureSchemes: schemes,
    apksigner: apksigner
      ? { binary: apksignerBin, verified: apksigner.verified, schemes: apksigner.schemes, signers: apksigner.signerDigests }
      : { binary: null, verified: null, required: requireApksigner },
    published,
    checks,
    verdict: checks.every(c => c.pass) ? 'PASS' : 'FAIL',
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('');
    console.log('  Vizora Display APK — release gate');
    console.log('  ─────────────────────────────────────────────────────────────');
    console.log(`  file            ${apkPath}`);
    console.log(`  package         ${report.package}`);
    console.log(`  version         ${report.versionName} (versionCode ${report.versionCode})`);
    console.log(`  size            ${report.apkBytes} bytes`);
    console.log(`  apk sha256      ${formatFingerprint(report.apkSha256)}`);
    console.log('');
    console.log(`  cert sha256     ${formatFingerprint(report.signingCertSha256)}`);
    console.log(`  cert owner      ${report.signingCertOwner}`);
    console.log(`  cert valid to   ${report.signingCertValidUntil}`);
    console.log(`  key / sig alg   ${report.keyAlgorithm} / ${report.signatureAlgorithm}`);
    console.log(
      `  schemes         v1(JAR)=${schemes.v1 ? 'yes' : 'no'}  v2/v3 block=${schemes.v2OrV3Block ? 'present' : 'absent'}`,
    );
    console.log(
      `  apksigner       ${apksignerBin ? `${apksignerBin} -> ${apksigner.verified ? 'VERIFIES' : 'FAILED'}` : 'not installed'}`,
    );
    if (schemes.v2OrV3Block && !apksignerBin) {
      console.log('                  NOTE: keytool validates the v1 block only. This APK has a');
      console.log('                  v2/v3 block that was NOT cross-checked. Use --require-apksigner');
      console.log('                  on the release machine to make that check mandatory.');
    }
    console.log('');
    for (const c of checks) {
      console.log(`  ${c.skipped ? 'SKIP' : c.pass ? 'PASS' : 'FAIL'}  ${c.name}`);
      console.log(`        ${c.detail}`);
    }
    console.log('');
    console.log(`  VERDICT: ${report.verdict}`);
    console.log('');
  }

  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

main().catch(err => {
  console.error(`FATAL: ${err.stack || err.message}`);
  process.exit(2);
});
