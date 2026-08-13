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
import { pathToFileURL } from 'node:url';

const DEFAULT_PACKAGE = 'com.vizora.display';

/**
 * The three compiled-in backend origins every release must pin and record.
 *
 * Named once so "all three are asserted" cannot drift into "whichever the data
 * happened to contain" — the failure mode this list exists to prevent.
 */
const ORIGIN_KEYS = ['api', 'realtime', 'dashboard'];

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

/** List the entry names inside an APK (a zip) using the bundled `unzip`. */
function listEntries(apkPath) {
  const out = execFileSync('unzip', ['-Z1', apkPath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return out.split('\n').map(l => l.trim()).filter(Boolean);
}

/**
 * Read the DEFAULT backend origins the bundle was COMPILED with, out of the APK.
 *
 * Scope, stated precisely: this proves build provenance — which origins were
 * compiled into the artifact as its defaults — and nothing more. It is NOT proof
 * of where a running device ends up pointed. The client seeds `DEFAULT_CONFIG`
 * from these values and then applies URL parameters and stored Preferences over
 * them, and the guarded `update_config` path can move a paired device to another
 * host in the same registrable domain. Effective runtime destination is a separate
 * question with its own controls; do not let this check be read as covering it.
 *
 * What it does close is the original hole: every other assertion here — package
 * id, version, certificate, hash — is indifferent to which origins were compiled
 * in, which is how an APK built against the wrong environment passed the gate.
 *
 * Reads the `__VIZORA_RELEASE_ORIGINS__` marker that vizora-tv stamps into the
 * bundle at build time. Deliberately NOT a scan for bare URLs: `api` and
 * `dashboard` are both https://vizora.cloud today, so loose URL matching could
 * report which hosts appear but never which value landed in which slot — and
 * "the right hosts are in there somewhere" is exactly the fuzzy check that passes
 * when it should not.
 *
 * @param apkPath path to the APK
 * @returns {{origins: object|null, entry: string|null, problem: string|null}}
 */
export function readPackagedOrigins(apkPath, deps = {}) {
  const list = deps.listEntries || listEntries;
  const read = deps.extractEntry || extractEntry;

  let entries;
  try {
    entries = list(apkPath);
  } catch (err) {
    return { origins: null, entry: null, problem: `could not list APK entries: ${err.message}` };
  }

  // The marker lives in the app bundle under the Capacitor web-asset root.
  const candidates = entries.filter(e => /^assets\/public\/.*\.js$/.test(e));
  if (candidates.length === 0) {
    return {
      origins: null,
      entry: null,
      problem: 'no packaged JS found under assets/public/ — this does not look like a Vizora Display APK',
    };
  }

  // Single-quoted after terser, double-quoted unminified: accept either, and let
  // the escape class handle a quote inside the JSON.
  const MARKER = /__VIZORA_RELEASE_ORIGINS__\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/;

  const found = [];
  for (const entry of candidates) {
    let text;
    try {
      text = read(apkPath, entry).toString('utf8');
    } catch {
      continue; // an unreadable sibling chunk must not mask the real marker
    }
    const m = MARKER.exec(text);
    if (!m) continue;

    // The capture is the BODY of a JS string literal holding JSON, so it has to be
    // unescaped before it can be parsed — and the two quote styles need different
    // handling. In a double-quoted literal every inner `"` is already backslashed,
    // so the body is a valid JSON-string body as-is. In a single-quoted literal the
    // inner `"` are bare and must be escaped first. Treating both the same way
    // double-escapes the already-escaped case and produces garbage.
    let parsed;
    try {
      const body =
        m[1] !== undefined
          ? m[1]
          : m[2].replace(/\\'/g, "'").replace(/"/g, '\\"');
      parsed = JSON.parse(JSON.parse(`"${body}"`));
    } catch (err) {
      return { origins: null, entry, problem: `origins marker in ${entry} is not valid JSON: ${err.message}` };
    }
    found.push({ entry, parsed });
  }

  if (found.length === 0) {
    return {
      origins: null,
      entry: null,
      problem:
        'no __VIZORA_RELEASE_ORIGINS__ marker in the packaged bundle. Either this APK predates the ' +
        'marker (vizora-tv#18) or the build stripped it — a release cannot be verified without it.',
    };
  }

  // More than one chunk carrying the marker is only a problem if they disagree;
  // disagreement means the bundle was assembled from mismatched builds.
  const distinct = [...new Set(found.map(f => JSON.stringify(f.parsed)))];
  if (distinct.length > 1) {
    return {
      origins: null,
      entry: found.map(f => f.entry).join(', '),
      problem: `packaged chunks disagree about the compiled origins: ${distinct.join(' vs ')}`,
    };
  }

  return { origins: found[0].parsed, entry: found[0].entry, problem: null };
}

/**
 * Compare the origins read from the artifact against the pinned expectation.
 * Pure, so the fail-closed behaviour is unit-testable without an APK fixture —
 * same shape as evaluatePinnedCert below, and for the same reason.
 *
 * @param pinned   expected origins from release.json ({} / null when unset)
 * @param actual   origins read out of the APK (null when unreadable)
 * @param problem  why they could not be read, if they could not
 * @param required true when publishing (--require-pinned-origins)
 */
export function evaluatePackagedOrigins(pinned, actual, problem, required) {
  const name = 'compiled default origins match the pinned expectation';
  const keys = ORIGIN_KEYS;

  const isFilled = (obj, k) => typeof obj?.[k] === 'string' && obj[k].length > 0;
  const pinnedKeys = keys.filter(k => isFilled(pinned, k));

  // A PARTIAL pin is malformed data, not an absent one, and it fails closed in
  // every mode — including outside publishing, exactly like a malformed cert pin.
  //
  // This is the shape of the bug that shipped in the first draft of this function:
  // "a pin exists" was decided with .some(), then only the keys that happened to be
  // present were compared. A releaseOrigins block carrying just `api` therefore
  // passed on `api` alone while `realtime` and `dashboard` silently dropped out of
  // the assertion — the check reporting PASS while covering one third of what it
  // claims. Requiring all three up front is what makes "all three are asserted" a
  // property of the code rather than of the data it happens to be handed.
  if (pinnedKeys.length > 0 && pinnedKeys.length < keys.length) {
    const missing = keys.filter(k => !isFilled(pinned, k));
    return {
      name,
      pass: false,
      detail:
        `INCOMPLETE PIN — releaseOrigins must pin all of ${keys.join(', ')}; ` +
        `missing or empty: ${missing.join(', ')}.\n        ` +
        `A partial pin drops the unpinned origins from the comparison entirely, so a ` +
        `mis-pointed one would pass unnoticed. Fix the pin rather than publishing against it.`,
    };
  }

  if (pinnedKeys.length === 0) {
    if (required) {
      return {
        name,
        pass: false,
        detail:
          'NO ORIGINS PINNED — releaseOrigins is missing from release.json. Publishing without ' +
          'a pinned expectation is how an APK compiled against the wrong backend reaches ' +
          'customers: every other check here passes regardless of which origins it was built with.',
      };
    }
    return {
      name,
      pass: true,
      skipped: true,
      detail: 'SKIPPED — no releaseOrigins pinned in release.json. Publish always requires it.',
    };
  }

  if (!actual) {
    return { name, pass: false, detail: `could not read the compiled origins: ${problem}` };
  }

  // The artifact must carry all three too. A marker missing a key is as unverifiable
  // as a marker missing entirely, and must not pass on the strength of the others.
  const absent = keys.filter(k => !isFilled(actual, k));
  if (absent.length) {
    return {
      name,
      pass: false,
      detail:
        `INCOMPLETE MARKER — the APK records no value for: ${absent.join(', ')}. ` +
        `All of ${keys.join(', ')} must be present to verify the build.`,
    };
  }

  const mismatches = keys
    .filter(k => actual[k] !== pinned[k])
    .map(k => `${k}: apk compiled with ${actual[k]}, pin expects ${pinned[k]}`);

  if (mismatches.length) {
    return {
      name,
      pass: false,
      detail:
        `MISMATCH — this APK was compiled against different origins than the pin allows.\n        ` +
        mismatches.join('\n        ') +
        `\n        Do not publish it: installs would default to the wrong environment.`,
    };
  }

  return { name, pass: true, detail: keys.map(k => `${k}=${actual[k]}`).join('  ') };
}

/**
 * Compare the artifact's compiled origins against the previously PUBLISHED
 * artifact's, so a change of backend is a deliberate, visible act rather than
 * something that slips through between releases — the same role
 * `signingCertSha256` plays for the key.
 *
 * Absent baseline is an explicit SKIP, never a silent pass: releases predating the
 * origins marker have nothing to compare against, and that must not read as a
 * continuity check that ran and succeeded.
 */
export function evaluateOriginsBaseline(baselineOrigins, actual, transition, pinned) {
  const name = 'compiled default origins match the previously published release';
  const keys = ORIGIN_KEYS;
  const isFilled = (obj, k) => typeof obj?.[k] === 'string' && obj[k].length > 0;
  const complete = obj => Boolean(obj) && keys.every(k => isFilled(obj, k));
  const describe = obj => keys.map(k => `${k}=${obj?.[k] ?? '(absent)'}`).join('  ');

  // ABSENT is special; MALFORMED is not. A null baseline genuinely has nothing to
  // compare against — 1.3.13 predates the origins marker — and that is the only
  // case allowed to skip. A non-null baseline missing or emptying a key is bad
  // data, and letting it skip would rebuild the exact escape hatch just removed
  // from the policy-pin check: malformed input silently disabling the control.
  if (baselineOrigins === null || baselineOrigins === undefined) {
    return {
      name,
      pass: true,
      skipped: true,
      detail:
        'SKIPPED — the published baseline records no compiled origins (it predates the ' +
        "origins marker). This artifact's origins become the baseline once promoted to published.",
    };
  }

  if (!complete(baselineOrigins)) {
    const missing = keys.filter(k => !isFilled(baselineOrigins, k));
    return {
      name,
      pass: false,
      detail:
        `INCOMPLETE BASELINE — published.compiledOrigins is present but missing or empty for: ` +
        `${missing.join(', ')}.\n        ` +
        `A partial baseline is corrupt release metadata, not an absent one. Treating it as ` +
        `absent would let malformed data silently switch this check off. Repair the published ` +
        `record — do not publish against it.`,
    };
  }

  if (!actual) {
    return { name, pass: false, detail: 'could not read the compiled origins from this APK' };
  }

  const changed = keys.filter(k => actual[k] !== baselineOrigins[k]);
  if (changed.length === 0) {
    return { name, pass: true, detail: 'unchanged from the published release' };
  }

  // ─── The artifact moves environments ───────────────────────────────────────
  //
  // `published` describes the artifact that is CURRENTLY LIVE. Editing it to the
  // new origins so the gate goes green would falsify the record of what customers
  // are actually running, to authorise a change that has not happened yet — the
  // one file whose job is to be true about production. It stays immutable until
  // the new candidate is genuinely published.
  //
  // A deliberate migration is therefore authorised OUT OF BAND, by an explicit
  // transition that names where it is coming from and going to. That keeps the
  // approval auditable and self-invalidating: once `from` no longer matches the
  // live baseline, the transition has been consumed and cannot silently authorise
  // a second, different move.
  const detailChanged = changed
    .map(k => `${k}: published ${baselineOrigins[k]} -> this build ${actual[k]}`)
    .join('\n        ');

  if (!transition) {
    return {
      name,
      pass: false,
      detail:
        `UNAUTHORISED ORIGIN CHANGE — this build was compiled against different origins ` +
        `than the published release:\n        ${detailChanged}\n        ` +
        `If this move is intended, record an approved originTransition {from, to, approvedBy, ` +
        `approvedAt} in release.json. Do NOT edit published.compiledOrigins to match: that ` +
        `record describes what is live right now, and rewriting it to clear a gate would make ` +
        `it a lie about production.`,
    };
  }

  const problems = [];
  if (!complete(transition.from)) problems.push('originTransition.from does not name all three origins');
  else if (keys.some(k => transition.from[k] !== baselineOrigins[k])) {
    problems.push(
      `originTransition.from does not match the live published baseline ` +
        `(transition says ${describe(transition.from)}; published is ${describe(baselineOrigins)}). ` +
        `A stale transition must not authorise a different move than the one approved.`,
    );
  }

  if (!complete(transition.to)) problems.push('originTransition.to does not name all three origins');
  else {
    if (keys.some(k => transition.to[k] !== actual[k])) {
      problems.push(
        `originTransition.to does not match what this APK was actually compiled with ` +
          `(transition says ${describe(transition.to)}; apk has ${describe(actual)})`,
      );
    }
    if (!complete(pinned)) {
      problems.push('releaseOrigins is missing or incomplete, so the transition target cannot be corroborated');
    } else if (keys.some(k => transition.to[k] !== pinned[k])) {
      problems.push(
        `originTransition.to does not match the releaseOrigins policy pin ` +
          `(transition says ${describe(transition.to)}; pin is ${describe(pinned)})`,
      );
    }
  }

  if (!transition.approvedBy) problems.push('originTransition.approvedBy is empty — a migration needs a named approver');
  if (!transition.approvedAt) problems.push('originTransition.approvedAt is empty');

  if (problems.length) {
    return {
      name,
      pass: false,
      detail:
        `ORIGIN TRANSITION REJECTED — the change is declared but not properly authorised:` +
        `\n        ${detailChanged}\n        ` +
        problems.map(p => `- ${p}`).join('\n        '),
    };
  }

  return {
    name,
    pass: true,
    detail:
      `authorised migration by ${transition.approvedBy} on ${transition.approvedAt}:\n        ` +
      detailChanged +
      `\n        published.compiledOrigins stays as-is until this build is actually published.`,
  };
}

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
export function normalizeFingerprint(fp) {
  return String(fp).replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
}

export function formatFingerprint(hex) {
  return (hex.match(/.{2}/g) || []).join(':');
}

/**
 * Decide the pinned-canonical-certificate check. Pure, so the fail-closed
 * behaviour is unit-testable without an APK fixture.
 *
 * This is the check that protects the FIRST publish. The `published` baseline
 * only exists from release 2 onward, and release 1 is exactly where the
 * 2026-08-10 mismatch was found — the only release APK was signed with a key
 * that is not on the build machine.
 *
 * @param pinned   normalized fingerprint from release.json signing.canonicalCertSha256 ('' when unset)
 * @param actual   normalized fingerprint read from the APK
 * @param required true when publishing (--require-pinned-cert)
 */
export function evaluatePinnedCert(pinned, actual, required) {
  const name = 'certificate matches the pinned canonical signing identity';

  if (pinned) {
    const matches = pinned === actual;
    return {
      name,
      pass: matches,
      detail: matches
        ? formatFingerprint(pinned)
        : `MISMATCH — pinned ${formatFingerprint(pinned)} vs apk ${formatFingerprint(actual)}. ` +
          `This APK was NOT signed with the canonical customer key. Do not publish it.`,
    };
  }

  if (required) {
    return {
      name,
      pass: false,
      detail:
        'NO CANONICAL CERTIFICATE PINNED — signing.canonicalCertSha256 is null in release.json. ' +
        'Publishing without a pinned identity is how an APK signed by an unrecoverable key ' +
        'reaches customers. Complete Gate B, then pin the fingerprint.',
    };
  }

  return {
    name,
    pass: true,
    skipped: true,
    detail:
      'SKIPPED — no canonical certificate pinned in release.json. ' +
      'Run with --require-pinned-cert (publish always does) to make this mandatory.',
  };
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
  let pinnedCert = '';
  let pinnedOrigins = null;
  let originTransition = null;
  if (args.against) {
    const p = resolve(String(args.against));
    if (!existsSync(p)) {
      console.error(`FATAL: baseline manifest not found: ${p}`);
      process.exit(2);
    }
    const doc = JSON.parse(readFileSync(p, 'utf8'));
    baseline = Object.prototype.hasOwnProperty.call(doc, 'published') ? doc.published : doc;
    if (!baseline) baselineAbsent = true;
    pinnedCert = normalizeFingerprint(doc?.signing?.canonicalCertSha256 || '');
    pinnedOrigins = doc?.releaseOrigins || null;
    originTransition = doc?.originTransition || null;
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

  // 3c. APK certificate matches the PINNED canonical signing identity.
  //
  // This is the check that protects the FIRST publish. The `published` baseline
  // below only exists from release 2 onward, and release 1 is precisely where
  // the 2026-08-10 mismatch was found: the only release APK was signed with a
  // key that is not on the build machine. Publishing requires a pin, and the
  // APK must match it.
  checks.push(evaluatePinnedCert(pinnedCert, cert.sha256, Boolean(args['require-pinned-cert'])));

  // 3d. The default origins this APK was COMPILED with.
  //
  // Read from the packaged bundle, not from the build config, because the config
  // only says what we intended. Every check above is origin-blind — a build made
  // against the wrong environment has a valid package id, a correct version, the
  // right certificate and a perfectly good hash. This is the one that catches it.
  //
  // Build provenance only: the client layers URL params, stored Preferences and the
  // guarded update_config path over these defaults at runtime.
  const packagedOrigins = readPackagedOrigins(apkPath);
  checks.push(
    evaluatePackagedOrigins(
      pinnedOrigins,
      packagedOrigins.origins,
      packagedOrigins.problem,
      Boolean(args['require-pinned-origins']),
    ),
  );

  // 3e. Release-over-release continuity for the origins, mirroring what
  // signingCertSha256 does for the key: `published.compiledOrigins` is the baseline,
  // so moving environments has to be a deliberate edit rather than a silent drift.
  if (baseline) {
    checks.push(
      evaluateOriginsBaseline(baseline.compiledOrigins, packagedOrigins.origins, originTransition, pinnedOrigins),
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
    compiledOrigins: packagedOrigins.origins,
    compiledOriginsEntry: packagedOrigins.entry,
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
    if (report.compiledOrigins) {
      console.log(`  api origin      ${report.compiledOrigins.api ?? '(absent)'}`);
      console.log(`  realtime origin ${report.compiledOrigins.realtime ?? '(absent)'}`);
      console.log(`  dashboard orig. ${report.compiledOrigins.dashboard ?? '(absent)'}`);
    } else {
      console.log(`  compiled origin unreadable — ${packagedOrigins.problem}`);
    }
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

// Only run the CLI when executed directly — importing this module (for tests)
// must not trigger a verification run or call process.exit().
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch(err => {
    console.error(`FATAL: ${err.stack || err.message}`);
    process.exit(2);
  });
}
