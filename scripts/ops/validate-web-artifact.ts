#!/usr/bin/env npx tsx
/**
 * Vizora — validate a web build artifact BEFORE it is allowed near production.
 *
 *   npx tsx scripts/ops/validate-web-artifact.ts <path-to-.next>
 *
 * Exit codes: 0 valid · 1 invalid · 2 could not evaluate
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * On 2026-08-12 an in-place `next build` on the prod VPS was OOM-killed
 * mid-compile (node RSS 2.05 GB, killed 20:40) and destroyed the live artifact.
 * It left a tree that LOOKED like a build — `types/`, `build/chunks/`,
 * `diagnostics/` — but had no `server/`, no `static/` content, no client
 * reference manifests and no `500.html`. The running `next-server` kept serving
 * HTML from already-open inodes while every path-resolved read returned 500.
 *
 * So "the directory exists" and "the build exited 0" are both insufficient. This
 * validator requires the artifact to prove INTERNAL CONSISTENCY: walk from the
 * emitted manifests to the files they reference and confirm each one is present.
 * A partial tree fails here rather than in production.
 *
 * Deliberately makes no network calls and never touches the live deployment —
 * it validates a staging directory only.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  fatal: boolean;
}

const checks: Check[] = [];
function check(name: string, ok: boolean, detail: string, fatal = true): void {
  checks.push({ name, ok, detail, fatal });
}

function countFiles(dir: string, filter?: (f: string) => boolean): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!filter || filter(entry.name)) n++;
    }
  };
  try { walk(dir); } catch { /* unreadable subtree counts as zero */ }
  return n;
}

function main(): void {
  const root = process.argv[2];
  if (!root) {
    process.stderr.write('usage: validate-web-artifact.ts <path-to-.next>\n');
    process.exitCode = 2;
    return;
  }
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    process.stderr.write(`not a directory: ${root}\n`);
    process.exitCode = 2;
    return;
  }

  // ── Provenance ────────────────────────────────────────────────────────────
  const metaPath = join(root, 'build-metadata.env');
  let meta: Record<string, string> = {};
  if (existsSync(metaPath)) {
    for (const line of readFileSync(metaPath, 'utf-8').split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0) meta[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  check('provenance: build-metadata.env present', existsSync(metaPath),
    existsSync(metaPath) ? `sourceCommit=${meta.sourceCommit ?? '?'} builtBy=${meta.builtBy ?? '?'}` : 'missing');
  check('provenance: sourceCommit recorded', Boolean(meta.sourceCommit),
    meta.sourceCommit ?? 'absent');
  check('provenance: public build inputs recorded',
    Boolean(meta.NEXT_PUBLIC_API_URL && meta.NEXT_PUBLIC_SOCKET_URL),
    `API=${meta.NEXT_PUBLIC_API_URL ?? '?'} SOCKET=${meta.NEXT_PUBLIC_SOCKET_URL ?? '?'}`);

  // ── Server output ─────────────────────────────────────────────────────────
  // The OOM-killed tree had ZERO server .js files. This is the single most
  // discriminating check between a complete build and that partial tree.
  const serverJs = countFiles(join(root, 'server'), f => f.endsWith('.js'));
  check('server output present', serverJs > 0, `${serverJs} .js under server/`);

  // ── Client bundle ─────────────────────────────────────────────────────────
  const staticFiles = countFiles(join(root, 'static'));
  const staticJs = countFiles(join(root, 'static'), f => f.endsWith('.js'));
  check('static/ is populated', staticFiles > 0, `${staticFiles} files (${staticJs} .js)`);
  check('client JS chunks emitted', staticJs > 0, `${staticJs} .js under static/`);

  // ── Error assets ──────────────────────────────────────────────────────────
  // Missing 500.html is why the production failure surfaced as a bare 500
  // instead of an error page.
  const has500 = existsSync(join(root, 'server', 'pages', '500.html'))
    || existsSync(join(root, 'server', 'app', '_error.html'));
  check('error page asset present', has500, has500 ? 'found' : 'no 500.html / _error.html', false);

  // ── Build identity ────────────────────────────────────────────────────────
  // Next emits BUILD_ID for webpack builds; turbopack layouts differ, so this
  // is informational rather than fatal — the server/static checks above are
  // what actually discriminate.
  const buildId = existsSync(join(root, 'BUILD_ID'));
  check('BUILD_ID present', buildId, buildId ? readFileSync(join(root, 'BUILD_ID'), 'utf-8').trim() : 'absent (turbopack layouts may omit it)', false);
  const rsf = existsSync(join(root, 'required-server-files.json'));
  check('required-server-files.json present', rsf, rsf ? 'found' : 'absent', false);

  // ── Internal consistency: manifests → referenced files ────────────────────
  // The core requirement. A manifest that names files which do not exist is
  // precisely the production failure mode, so walk the references.
  const manifestPath = join(root, 'build-manifest.json');
  if (existsSync(manifestPath)) {
    let referenced: string[] = [];
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
      const collect = (v: unknown): void => {
        if (typeof v === 'string') { if (/\.(js|css)$/.test(v)) referenced.push(v); }
        else if (Array.isArray(v)) v.forEach(collect);
        else if (v && typeof v === 'object') Object.values(v).forEach(collect);
      };
      collect(manifest);
      referenced = [...new Set(referenced)];
    } catch (err) {
      check('build-manifest.json parses', false, err instanceof Error ? err.message : String(err));
    }

    const missing = referenced.filter(rel => !existsSync(join(root, rel)));
    check('every manifest-referenced asset exists',
      referenced.length > 0 && missing.length === 0,
      referenced.length === 0
        ? 'manifest referenced no assets — cannot confirm consistency'
        : `${referenced.length} referenced, ${missing.length} missing${missing.length ? `: ${missing.slice(0, 5).join(', ')}` : ''}`);
  } else {
    check('build-manifest.json present', false,
      'absent — internal consistency cannot be walked from a manifest', false);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const width = Math.max(...checks.map(c => c.name.length));
  process.stdout.write(`web artifact validation: ${root}\n\n`);
  for (const c of checks) {
    const mark = c.ok ? 'PASS' : (c.fatal ? 'FAIL' : 'WARN');
    process.stdout.write(`  [${mark}] ${c.name.padEnd(width)}  ${c.detail}\n`);
  }

  const failures = checks.filter(c => !c.ok && c.fatal);
  const warnings = checks.filter(c => !c.ok && !c.fatal);
  process.stdout.write(`\n${failures.length === 0 ? 'VALID' : 'INVALID'} — ${failures.length} failure(s), ${warnings.length} warning(s)\n`);
  if (failures.length > 0) {
    process.stdout.write('\nThis artifact must NOT be deployed.\n');
  }
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main();
