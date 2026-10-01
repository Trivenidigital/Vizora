/**
 * LOCAL-ONLY visual + a11y audit harness for the authenticated Vizora surface.
 *
 * Drives the real app in a real browser and records, per route x theme x viewport:
 *   - a screenshot
 *   - elements clipped by the viewport edge (works even under `overflow-x: hidden`)
 *   - computed WCAG contrast for every visible text run
 *   - undersized touch targets (mobile viewports only)
 *   - console errors
 *
 * Why this exists rather than eyeballing screenshots:
 *   `docs/plans/2026-08-03-full-app-rebrand.md` records eight traps that have
 *   already cost rework. Three of them are invisible to a screenshot:
 *     - trap 7: `overflow-x: hidden` hides clipping, so the usual
 *       `scrollWidth - clientWidth === 0` assertion cannot detect an element
 *       sliced at the viewport edge. We measure per-element rects instead.
 *     - trap 8: a rule existing in the compiled CSS does not prove any element
 *       receives it. We read computed styles off live nodes.
 *     - the contrast note: "compute it - four of six numbers in an earlier
 *       hand-written comment were wrong." So we compute, never assert by hand.
 *
 * Usage:
 *   DEMO_TENANT_PASSWORD=... node scripts/design/audit-surface.mjs \
 *     [--routes /dashboard,/dashboard/devices] \
 *     [--viewports 1440,390] [--themes light,dark] [--out DIR] [--tag before]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';

/*
 * The scanner lives in its own module so it can be pointed at a fixture as well as
 * at the app — see its header, and `audit-scan-svg-control.mjs`, which is what
 * proves it reports SVG text correctly in both directions.
 */
import { SCAN } from './audit-scan.mjs';

const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.DEMO_TENANT_EMAIL || 'demo@vizora.local';
const PASSWORD = process.env.DEMO_TENANT_PASSWORD;
/** The synthetic org seeded by scripts/marketing/seed-demo-tenant.mjs. Nothing else may be audited. */
const EXPECTED_TENANT = 'Northwind Coffee Roasters';

if (!PASSWORD) throw new Error('Set DEMO_TENANT_PASSWORD (same value used to seed the demo tenant).');

/**
 * Same two guards as the marketing capture script, for the same reason: a
 * local-looking URL proves nothing about which database is behind it. Guard 2
 * (tenant identity, checked after login) is the one that actually protects
 * real data - point a locally-running web server at a production middleware
 * and this aborts before the first screenshot.
 */
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
  throw new Error(`Refusing to log in against non-local target: ${BASE}`);
}

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const DEFAULT_ROUTES = [
  '/dashboard',
  '/dashboard/devices',
  '/dashboard/playlists',
  '/dashboard/content',
  '/dashboard/schedules',
  '/dashboard/analytics',
  '/dashboard/settings',
  '/dashboard/settings/team',
  '/dashboard/settings/billing',
];

const ROUTES = arg('routes', DEFAULT_ROUTES.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const VIEWPORTS = arg('viewports', '1440,390').split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);
const THEMES = arg('themes', 'light,dark').split(',').map((s) => s.trim()).filter(Boolean);
const TAG = arg('tag', 'audit');
const OUT_DIR = arg('out', nodePath.join(os.tmpdir(), 'vizora-design-audit', TAG));

const VIEWPORT_HEIGHT = { 1440: 900, 1280: 800, 1024: 768, 768: 1024, 430: 932, 390: 844, 375: 812, 320: 640 };

fs.mkdirSync(OUT_DIR, { recursive: true });

/* ---------- driver ---------- */

const slug = (r) => (r === '/' ? 'root' : r.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-'));

const browser = await chromium.launch();

/**
 * --public audits signed-OUT routes: the marketing pages, the legal pages and
 * the four auth screens. Those live inside the `.mkt` scope, which is this
 * wave's visual benchmark, so they need regression checking on every CSS
 * change — and they cannot be reached through a login.
 *
 * Skipping the login also skips the tenant-identity guard. That is safe here
 * and only here: these routes render no tenant data, so there is nothing to
 * photograph by accident. The local-origin guard above still applies.
 */
const PUBLIC_ONLY = process.argv.includes('--public');
let storageState;

if (PUBLIC_ONLY) {
  console.log('public mode — no login, no tenant data reachable');
} else {
// Log in once, then reuse the session across every theme/viewport context.
console.log('login…');
const bootstrap = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const bp = await bootstrap.newPage();
await bp.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
/**
 * Wait for hydration before typing. The login fields are React-controlled, so
 * input typed before the handlers attach updates the DOM value but never the
 * component state - the form then rejects itself with "Email is required"
 * while visibly containing an email. This cost a debugging cycle; do not
 * replace this with a bare fill().
 */
await bp.waitForSelector('#email:not([disabled])', { timeout: 30_000 });
await bp.waitForTimeout(1500);
await bp.locator('#email').pressSequentially(EMAIL, { delay: 15 });
await bp.locator('#password').pressSequentially(PASSWORD, { delay: 15 });
await bp.click('button[type="submit"]');
await bp.waitForURL(/\/dashboard/, { timeout: 60_000 }).catch(() => {});
if (!/\/dashboard/.test(bp.url())) {
  throw new Error(`Refusing to audit: login did not reach the dashboard (at ${bp.url()}).`);
}
// Give the shell time to render the org context before asserting on it -
// asserting too early fails closed on a correct tenant.
const found = await bp
  .waitForFunction(
    (name) => document.body.innerText.includes(name),
    EXPECTED_TENANT,
    { timeout: 30_000 },
  )
  .then(() => true)
  .catch(() => false);
if (!found) {
  throw new Error(
    `Refusing to audit: logged-in workspace is not the synthetic demo tenant ` +
      `("${EXPECTED_TENANT}" not found). Re-seed with scripts/marketing/seed-demo-tenant.mjs.`,
  );
}
console.log(`  tenant verified: ${EXPECTED_TENANT}`);
storageState = await bootstrap.storageState();
await bootstrap.close();
}

const report = [];

for (const theme of THEMES) {
  for (const vw of VIEWPORTS) {
    const height = VIEWPORT_HEIGHT[vw] || 900;
    const isMobile = vw <= 500;
    const ctx = await browser.newContext({
      ...(storageState ? { storageState } : {}),
      viewport: { width: vw, height },
      colorScheme: theme === 'dark' ? 'dark' : 'light',
      deviceScaleFactor: 1,
      hasTouch: isMobile,
      isMobile,
    });
    // Set both before any app code runs, so the first paint is already correct.
    await ctx.addInitScript(
      ([t]) => {
        try {
          localStorage.setItem('theme-mode', t);
          localStorage.setItem('vizora_cookie_consent', 'all');
        } catch {}
      },
      [theme],
    );

    for (const route of ROUTES) {
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
      });
      page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));

      const file = `${slug(route)}__${theme}__${vw}.png`;
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        // Let data land + skeletons resolve. networkidle is unreliable with a
        // live socket open, so we settle on a fixed budget instead.
        await page.waitForTimeout(3500);
        // Strip dev-only tooling chrome that is not part of the product surface.
        await page.addStyleTag({ content: 'nextjs-portal{display:none !important;}' });
        await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((n) => n.remove()));

        const scan = await page.evaluate(SCAN, { vw, isMobile });
        await page.screenshot({ path: nodePath.join(OUT_DIR, file), fullPage: true, animations: 'disabled' });

        report.push({ route, theme, viewport: vw, screenshot: file, consoleErrors, ...scan });
        const flags = [
          scan.focusRing && !scan.focusRing.passes ? `focus-ring ${scan.focusRing.ratio}:1` : '',
          scan.clipped.length ? `${scan.clipped.length} clipped` : '',
          scan.contrast.length ? `${scan.contrast.length} contrast` : '',
          scan.skipped?.length ? `${scan.skipped.length} unmeasurable` : '',
          scan.touch.length ? `${scan.touch.length} touch` : '',
          consoleErrors.length ? `${consoleErrors.length} console` : '',
        ].filter(Boolean).join(', ');
        console.log(`  ${theme} ${vw}px ${route} -> ${flags || 'clean'}`);
      } catch (err) {
        report.push({ route, theme, viewport: vw, screenshot: null, error: String(err).slice(0, 300), consoleErrors });
        console.log(`  ${theme} ${vw}px ${route} -> ERROR ${String(err).slice(0, 120)}`);
      }
      await page.close();
    }
    await ctx.close();
  }
}

await browser.close();

fs.writeFileSync(nodePath.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

/* ---------- human-readable summary ---------- */
const lines = [`# Vizora surface audit — ${TAG}`, ''];
let totalClip = 0, totalContrast = 0, totalTouch = 0, totalErr = 0, totalSkipped = 0;
for (const r of report) {
  totalClip += r.clipped?.length || 0;
  totalContrast += r.contrast?.length || 0;
  totalTouch += r.touch?.length || 0;
  totalErr += r.consoleErrors?.length || 0;
  totalSkipped += r.skipped?.length || 0;
}
/*
 * `unmeasurable` is reported alongside the failures on purpose. A text run whose
 * paint is a gradient or `none` is neither passing nor failing, and letting it drop
 * out silently makes "0 contrast findings" mean two different things.
 */
lines.push(`Captures: ${report.length} | clipped: ${totalClip} | contrast failures: ${totalContrast} | unmeasurable text runs: ${totalSkipped} | small touch targets: ${totalTouch} | console errors: ${totalErr}`, '');
for (const r of report) {
  if (r.error) { lines.push(`## ${r.route} [${r.theme} ${r.viewport}px] — ERROR: ${r.error}`, ''); continue; }
  const issues = (r.clipped.length + r.contrast.length + r.touch.length + r.consoleErrors.length + (r.skipped?.length || 0));
  if (!issues) continue;
  lines.push(`## ${r.route} [${r.theme} ${r.viewport}px]`);
  if (r.clipped.length) {
    lines.push(`**Clipped past viewport (${r.clipped.length})** — scrollWidth=${r.docScrollWidth} clientWidth=${r.docClientWidth}`);
    r.clipped.slice(0, 8).forEach((c) => lines.push(`- \`${c.el}\` +${c.overBy}px (${c.cause})`));
  }
  if (r.contrast.length) {
    lines.push(`**Contrast below AA (${r.contrast.length})**`);
    r.contrast.slice(0, 10).forEach((c) => lines.push(`- ${c.ratio}:1 (needs ${c.required}) \`${c.color}\` (${c.paintedBy || 'color'}) on \`${c.bg}\` — "${c.text}" — \`${c.el}\``));
  }
  if (r.skipped?.length) {
    lines.push(`**Text runs that could not be measured (${r.skipped.length})**`);
    r.skipped.slice(0, 8).forEach((x) => lines.push(`- ${x.reason} — "${x.text}" — \`${x.el}\``));
  }
  if (r.touch.length) {
    lines.push(`**Touch targets < 44px (${r.touch.length})**`);
    r.touch.slice(0, 8).forEach((t) => lines.push(`- \`${t.el}\` ${t.w}x${t.h}`));
  }
  if (r.consoleErrors.length) {
    lines.push(`**Console errors (${r.consoleErrors.length})**`);
    [...new Set(r.consoleErrors)].slice(0, 6).forEach((e) => lines.push(`- ${e}`));
  }
  lines.push('');
}
fs.writeFileSync(nodePath.join(OUT_DIR, 'SUMMARY.md'), lines.join('\n'));

console.log(`\nwrote ${report.length} captures to ${OUT_DIR}`);
console.log(`clipped=${totalClip} contrast=${totalContrast} unmeasurable=${totalSkipped} touch=${totalTouch} console=${totalErr}`);
