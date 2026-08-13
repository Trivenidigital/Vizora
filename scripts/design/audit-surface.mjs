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

/* ---------- in-page scanners (serialised into the browser) ---------- */

/**
 * Contrast + clipping + touch-target scan.
 *
 * Runs entirely in the page so it reads *computed* values off live nodes,
 * which is the only thing that proves an element actually receives a rule.
 */
const SCAN = ({ vw, isMobile }) => {
  /* --- colour helpers --- */
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  // Composite a possibly-translucent foreground over an opaque backdrop.
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  const label = (el) => {
    const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal ?? '');
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls.trim().split(/\s+/).slice(0, 4).join('.') : ''}`.slice(0, 140);
  };

  const visible = (el, cs, rect) => {
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
    if (rect.width === 0 || rect.height === 0) return false;
    return true;
  };

  /** Nearest ancestor painting an opaque-ish background; also reports image backdrops. */
  const effectiveBg = (el) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { color: null, indeterminate: true };
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (acc.a >= 0.999) return { color: acc, indeterminate: false };
      }
      node = node.parentElement;
    }
    return { color: acc && acc.a >= 0.999 ? acc : { r: 255, g: 255, b: 255, a: 1 }, indeterminate: false };
  };

  const clipped = [];
  const contrast = [];
  const touch = [];
  const seenText = new Set();

  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, cs, rect)) continue;

    /* --- clipping: real geometry, immune to overflow-x:hidden (trap 7) ---
     *
     * Extending past the viewport is NOT by itself a defect: a wide table
     * inside an `overflow-x: auto` scroller is perfectly reachable, and its
     * getBoundingClientRect() still reports the full width. Reporting on
     * geometry alone flags every legitimate scroller as broken.
     *
     * So walk up and find the first ancestor that governs horizontal overflow:
     *   auto/scroll that can actually scroll -> reachable, not a finding
     *   hidden/clip                          -> genuinely unreachable content
     *   nothing all the way up               -> depends on the document
     */
    if (rect.right > vw + 1 && rect.left < vw) {
      let node = el.parentElement;
      let verdict = null;
      while (node) {
        const pcs = getComputedStyle(node);
        const ox = pcs.overflowX;
        if (ox === 'auto' || ox === 'scroll') {
          verdict = node.scrollWidth > node.clientWidth + 1 ? null : `unscrollable:${label(node)}`;
          break;
        }
        if (ox === 'hidden' || ox === 'clip') {
          verdict = `hidden-by:${label(node)}`;
          break;
        }
        node = node.parentElement;
      }
      if (node === null) {
        const de = document.documentElement;
        verdict = de.scrollWidth > de.clientWidth + 1 ? null : 'hidden-by:document';
      }
      if (verdict) {
        clipped.push({ el: label(el), right: Math.round(rect.right), overBy: Math.round(rect.right - vw), cause: verdict });
      }
    }

    /* --- touch targets on mobile --- */
    if (isMobile) {
      const interactive =
        ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ||
        el.getAttribute('role') === 'button' ||
        el.getAttribute('role') === 'link';
      if (interactive && (rect.width < 44 || rect.height < 44)) {
        touch.push({ el: label(el), w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    }

    /* --- contrast: only elements with their own rendered text --- */
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!own || own.length < 2) continue;

    const fg = parse(cs.color);
    if (!fg || fg.a === 0) continue;
    const bg = effectiveBg(el);
    if (bg.indeterminate || !bg.color) continue;

    const composited = fg.a < 1 ? over(fg, bg.color) : fg;
    const r = ratio(composited, bg.color);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = large ? 3 : 4.5;

    if (r < required) {
      const key = `${cs.color}|${cs.fontSize}|${own.slice(0, 24)}`;
      if (seenText.has(key)) continue;
      seenText.add(key);
      contrast.push({
        el: label(el),
        text: own.slice(0, 60),
        color: cs.color,
        bg: `rgb(${Math.round(bg.color.r)}, ${Math.round(bg.color.g)}, ${Math.round(bg.color.b)})`,
        fontSize: cs.fontSize,
        weight,
        ratio: Math.round(r * 100) / 100,
        required,
      });
    }
  }

  return {
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    clipped: clipped.slice(0, 30),
    contrast: contrast.sort((a, b) => a.ratio - b.ratio).slice(0, 40),
    touch: touch.slice(0, 30),
  };
};

/* ---------- driver ---------- */

const slug = (r) => (r === '/' ? 'root' : r.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-'));

const browser = await chromium.launch();

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
const storageState = await bootstrap.storageState();
await bootstrap.close();

const report = [];

for (const theme of THEMES) {
  for (const vw of VIEWPORTS) {
    const height = VIEWPORT_HEIGHT[vw] || 900;
    const isMobile = vw <= 500;
    const ctx = await browser.newContext({
      storageState,
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
          scan.clipped.length ? `${scan.clipped.length} clipped` : '',
          scan.contrast.length ? `${scan.contrast.length} contrast` : '',
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
let totalClip = 0, totalContrast = 0, totalTouch = 0, totalErr = 0;
for (const r of report) {
  totalClip += r.clipped?.length || 0;
  totalContrast += r.contrast?.length || 0;
  totalTouch += r.touch?.length || 0;
  totalErr += r.consoleErrors?.length || 0;
}
lines.push(`Captures: ${report.length} | clipped: ${totalClip} | contrast failures: ${totalContrast} | small touch targets: ${totalTouch} | console errors: ${totalErr}`, '');
for (const r of report) {
  if (r.error) { lines.push(`## ${r.route} [${r.theme} ${r.viewport}px] — ERROR: ${r.error}`, ''); continue; }
  const issues = (r.clipped.length + r.contrast.length + r.touch.length + r.consoleErrors.length);
  if (!issues) continue;
  lines.push(`## ${r.route} [${r.theme} ${r.viewport}px]`);
  if (r.clipped.length) {
    lines.push(`**Clipped past viewport (${r.clipped.length})** — scrollWidth=${r.docScrollWidth} clientWidth=${r.docClientWidth}`);
    r.clipped.slice(0, 8).forEach((c) => lines.push(`- \`${c.el}\` +${c.overBy}px (${c.cause})`));
  }
  if (r.contrast.length) {
    lines.push(`**Contrast below AA (${r.contrast.length})**`);
    r.contrast.slice(0, 10).forEach((c) => lines.push(`- ${c.ratio}:1 (needs ${c.required}) \`${c.color}\` on \`${c.bg}\` — "${c.text}" — \`${c.el}\``));
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
console.log(`clipped=${totalClip} contrast=${totalContrast} touch=${totalTouch} console=${totalErr}`);
