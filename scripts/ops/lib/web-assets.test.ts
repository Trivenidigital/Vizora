/**
 * Web asset reference extraction — the WEB_HEALTH_FALSE_GREEN guard.
 *
 * Pins the 2026-08-12 failure shape: an OOM-killed `next build` wiped `.next`
 * while the running `next-server` kept serving HTML from open file handles, so
 * `/` returned 200 while every `/_next/static/*` it referenced returned 500.
 * The health probe checked only the HTML shell and reported web healthy for
 * 5h45m.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractReferencedAssets,
  planAssetProbe,
  summarizeAssetProbe,
} from './web-assets.js';

/** Shape of the HTML prod actually served during the incident. */
const REAL_HTML = `<!DOCTYPE html><html><head>
<title>Vizora — AI-Powered Digital Signage Platform</title>
<link rel="stylesheet" href="/_next/static/chunks/e1a2b3c4.css"/>
<script src="/_next/static/chunks/2mne9w-o6li3-.js" async=""></script>
<script src="/_next/static/chunks/0rr1439549e25.js" async=""></script>
</head><body><div id="__next"></div>
<script src="/_next/static/chunks/2yyd6o4feih3x.js"></script>
</body></html>`;

// ─── Extraction ──────────────────────────────────────────────────────────────

test('extracts the JS and CSS build assets the HTML references', () => {
  const assets = extractReferencedAssets(REAL_HTML);
  assert.deepEqual(assets, [
    '/_next/static/chunks/e1a2b3c4.css',
    '/_next/static/chunks/2mne9w-o6li3-.js',
    '/_next/static/chunks/0rr1439549e25.js',
    '/_next/static/chunks/2yyd6o4feih3x.js',
  ]);
});

test('de-duplicates repeated references', () => {
  const html = `<script src="/_next/static/chunks/a.js"></script>
                <script src="/_next/static/chunks/a.js"></script>`;
  assert.deepEqual(extractReferencedAssets(html), ['/_next/static/chunks/a.js']);
});

test('ignores external, inline and non-build assets', () => {
  // A probe that followed these would fail for reasons unrelated to artifact
  // integrity — a CDN outage is not a Vizora web-artifact problem.
  const html = `
    <script src="https://cdn.example.com/analytics.js"></script>
    <img src="data:image/png;base64,iVBORw0KGgo=" />
    <link href="/favicon.ico" rel="icon"/>
    <script src="/_next/static/chunks/real.js"></script>`;
  assert.deepEqual(extractReferencedAssets(html), ['/_next/static/chunks/real.js']);
});

test('handles single-quoted attributes', () => {
  assert.deepEqual(
    extractReferencedAssets(`<script src='/_next/static/chunks/q.js'></script>`),
    ['/_next/static/chunks/q.js'],
  );
});

test('returns nothing for HTML with no build assets', () => {
  assert.deepEqual(extractReferencedAssets('<html><body>hello</body></html>'), []);
});

// ─── Probe planning ──────────────────────────────────────────────────────────

test('plans a bounded sample rather than fetching every asset', () => {
  const plan = planAssetProbe(REAL_HTML);
  assert.equal(plan.unverifiable, false);
  assert.equal(plan.paths.length, 2, 'the 5-minute cadence should not refetch the whole bundle');
  assert.deepEqual(plan.paths, [
    '/_next/static/chunks/e1a2b3c4.css',
    '/_next/static/chunks/2mne9w-o6li3-.js',
  ]);
  assert.match(plan.reason, /4 asset\(s\) referenced/);
});

test('always probes at least one asset even if sampleSize is 0', () => {
  assert.equal(planAssetProbe(REAL_HTML, 0).paths.length, 1);
});

test('HTML referencing no build assets is UNVERIFIABLE, not passing', () => {
  // "nothing to check" and "everything checked out" are different states.
  // Conflating them is how the original blind spot survived.
  const plan = planAssetProbe('<html><body>maintenance</body></html>');
  assert.equal(plan.unverifiable, true);
  assert.deepEqual(plan.paths, []);
  assert.match(plan.reason, /could not be verified/);
});

// ─── Outcome summary ─────────────────────────────────────────────────────────

test('all assets served → healthy', () => {
  const r = summarizeAssetProbe([
    { path: '/_next/static/chunks/a.js', status: 200, ok: true },
    { path: '/_next/static/chunks/b.css', status: 200, ok: true },
  ]);
  assert.equal(r.ok, true);
  assert.match(r.detail, /2\/2 referenced asset\(s\) served/);
});

test('THE INCIDENT: HTML 200 but referenced assets 500 → UNHEALTHY', () => {
  // This is the exact condition that reported healthy for 5h45m.
  const r = summarizeAssetProbe([
    { path: '/_next/static/chunks/2mne9w-o6li3-.js', status: 500, ok: false },
    { path: '/_next/static/chunks/0rr1439549e25.js', status: 500, ok: false },
  ]);
  assert.equal(r.ok, false, 'a shell that renders is not a working app');
  assert.match(r.detail, /2\/2 referenced asset\(s\) failed/);
  assert.match(r.detail, /2mne9w-o6li3-\.js -> 500/);
});

test('a single failing asset is enough to fail the probe', () => {
  const r = summarizeAssetProbe([
    { path: '/_next/static/chunks/a.js', status: 200, ok: true },
    { path: '/_next/static/chunks/b.js', status: 500, ok: false },
  ]);
  assert.equal(r.ok, false);
  assert.match(r.detail, /1\/2 referenced asset\(s\) failed/);
});

test('a 404 fails too — HTML referencing a file that does not exist', () => {
  const r = summarizeAssetProbe([{ path: '/_next/static/chunks/gone.js', status: 404, ok: false }]);
  assert.equal(r.ok, false);
  assert.match(r.detail, /gone\.js -> 404/);
});

test('a network error is reported rather than swallowed', () => {
  const r = summarizeAssetProbe([
    { path: '/_next/static/chunks/a.js', ok: false, error: 'ECONNREFUSED' },
  ]);
  assert.equal(r.ok, false);
  assert.match(r.detail, /ECONNREFUSED/);
});

test('probing nothing is not a failure', () => {
  // Absence of assets is handled by planAssetProbe's unverifiable flag; the
  // summary must not manufacture a failure from an empty probe set.
  assert.equal(summarizeAssetProbe([]).ok, true);
});
