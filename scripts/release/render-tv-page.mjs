#!/usr/bin/env node
/**
 * Render deploy/tv/index.html from index.html.template + release.json.
 *
 * The installer page states a version and a SHA-256. Those must describe the
 * APK actually being published, so they are generated rather than hand-typed —
 * that is what makes "APK + displayed version + displayed hash" a single
 * release operation instead of three things that can drift apart.
 *
 * By default it renders the `candidate` block. `--from published` renders what
 * is currently live (used to regenerate the page without a version bump).
 *
 * Usage:
 *   node scripts/release/render-tv-page.mjs
 *   node scripts/release/render-tv-page.mjs --check      # verify page is in sync, write nothing
 *
 * Exit codes:
 *   0 — rendered (or, with --check, already in sync)
 *   1 — with --check: deploy/tv/index.html is stale vs release.json
 *   2 — bad inputs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tvDir = resolve(join(here, '..', '..', 'deploy', 'tv'));
const TEMPLATE = join(tvDir, 'index.html.template');
const OUTPUT = join(tvDir, 'index.html');
const RELEASE = join(tvDir, 'release.json');

function groupHex(hex) {
  // 64 hex chars is unreadable on a TV at 3 metres; group into 4s.
  return (hex.match(/.{4}/g) || []).join(' ');
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const fromIdx = args.indexOf('--from');
  const blockName = fromIdx !== -1 ? args[fromIdx + 1] : 'candidate';

  for (const f of [TEMPLATE, RELEASE]) {
    if (!existsSync(f)) {
      console.error(`FATAL: missing ${f}`);
      process.exit(2);
    }
  }

  const release = JSON.parse(readFileSync(RELEASE, 'utf8'));
  const block = release[blockName];
  if (!block) {
    console.error(`FATAL: release.json has no non-null "${blockName}" block`);
    process.exit(2);
  }

  for (const field of ['versionName', 'versionCode', 'apkSha256', 'apkBytes']) {
    if (block[field] === undefined || block[field] === null) {
      console.error(`FATAL: release.json ${blockName}.${field} is missing`);
      process.exit(2);
    }
  }

  if (!/^[0-9A-F]{64}$/.test(block.apkSha256)) {
    console.error(
      `FATAL: ${blockName}.apkSha256 is not 64 uppercase hex chars: "${block.apkSha256}". ` +
        `Regenerate it from verify-display-apk.mjs --json rather than typing it.`,
    );
    process.exit(2);
  }

  const values = {
    VERSION_NAME: String(block.versionName),
    VERSION_CODE: String(block.versionCode),
    APK_SHA256: block.apkSha256,
    APK_SHA256_SPACED: groupHex(block.apkSha256),
    APK_SIZE_MB: (block.apkBytes / (1024 * 1024)).toFixed(2),
  };

  let out = readFileSync(TEMPLATE, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{{${key}}}`).join(value);
  }

  const unresolved = out.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (unresolved) {
    console.error(`FATAL: unresolved placeholders in template: ${[...new Set(unresolved)].join(', ')}`);
    process.exit(2);
  }

  if (check) {
    const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
    if (current !== out) {
      console.error('STALE: deploy/tv/index.html does not match release.json — run render-tv-page.mjs');
      process.exit(1);
    }
    console.log(`in sync: deploy/tv/index.html matches release.json (${blockName} ${values.VERSION_NAME})`);
    process.exit(0);
  }

  writeFileSync(OUTPUT, out);
  console.log(`rendered deploy/tv/index.html from ${blockName} ${values.VERSION_NAME} (build ${values.VERSION_CODE})`);
  console.log(`  sha256 ${values.APK_SHA256_SPACED}`);
  console.log(`  size   ${values.APK_SIZE_MB} MB`);
}

main();
